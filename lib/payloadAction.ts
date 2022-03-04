import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSetting } from '../config/Settings';
import { ActionIds } from '../enum/ActionIds';
import {  DialogflowRequestType, IDialogflowAction, IDialogflowImageCard, IDialogflowMessage, IDialogflowPayload, IDialogflowQuickReplies, LanguageCode} from '../enum/Dialogflow';
import { Logs } from '../enum/Logs';
import { JobName } from '../enum/Scheduler';
import { getError } from '../lib/Helper';
import { getRoomAssoc, retrieveDataByAssociation, setIsProcessingMessage, updatePersistentData } from '../lib/Persistence';
import { closeChat, performHandover, updateRoomCustomFields } from '../lib/Room';
import { sendWelcomeEventToDialogFlow } from '../lib/sendWelcomeEvent';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage, createMessage } from './Message';
import { getLivechatAgentConfig } from './Settings';

export const  handlePayloadActions = async (app: IApp, read: IRead,  modify: IModify, http: IHttp, persistence: IPersistence, rid: string, visitorToken: string, dialogflowMessage: IDialogflowMessage) => {
    const { messages = [] } = dialogflowMessage;
    for (const message of messages) {
        const { action = null } = message as IDialogflowPayload;
        if (action) {
            const { name: actionName, params } = action as IDialogflowAction;
            const targetDepartment: string = await getLivechatAgentConfig(read, rid, AppSetting.FallbackTargetDepartment);
            if (actionName) {
                if (actionName === ActionIds.PERFORM_HANDOVER) {
                    if (!targetDepartment) {
                        console.error(Logs.EMPTY_HANDOVER_DEPARTMENT);
                    }
                    if (params) {
                        const customFields: any = {};
                        if (params.salesforceButtonId) {
                            customFields.reqButtonId = params.salesforceButtonId;
                        }
                        if (params.salesforceId) {
                            customFields.salesforceId = params.salesforceId;
                        }
                        if (params.customDetail) {
                            customFields.customDetail = params.customDetail;
                        }
                        if (Object.keys(customFields).length > 0) {
                            await updateRoomCustomFields(rid, customFields, read, modify);
                        }
                    }
                    await performHandover(app, modify, read, rid, visitorToken, targetDepartment);
                } else if (actionName === ActionIds.CLOSE_CHAT) {
                    await closeChat(modify, read, rid);
                } else if (actionName === ActionIds.NEW_WELCOME_EVENT) {
                    const livechatRoom = await read.getRoomReader().getById(rid) as ILivechatRoom;
                    if (!livechatRoom) { throw new Error(Logs.INVALID_ROOM_ID); }
                    const { visitor: { livechatData } } = livechatRoom;
                    await sendWelcomeEventToDialogFlow(app, read, modify, persistence, http, rid, visitorToken, livechatData);
                } else if (actionName === ActionIds.SET_TIMEOUT) {

                    const task = {
                        id: JobName.EVENT_SCHEDULER,
                        when: `${Number(params.time)} seconds`,
                        data: {
                            eventName: params.eventName ,
                            rid,
                            sessionId: rid,
                            jobName: JobName.EVENT_SCHEDULER,
                        },
                    };

                    try {
                        await modify.getScheduler().scheduleOnce(task);

                        // Start blackout window
                        if (params.continue_blackout) {
                            await setIsProcessingMessage(persistence, rid, true);
                        }
                    } catch (error) {
                        console.error(error);
                        const serviceUnavailable: string = await getLivechatAgentConfig(read, rid, AppSetting.DialogflowServiceUnavailableMessage);
                        await createMessage(rid, read, modify, { text: serviceUnavailable }, app);
                        return;
                    }

                } else if (actionName === ActionIds.CHANGE_LANGUAGE_CODE) {
                    const assoc = getRoomAssoc(rid);
                    const data = await retrieveDataByAssociation(read, assoc);

                    if (data.custom_languageCode !== params.newLanguageCode) {
                        await updatePersistentData(read, persistence, assoc, {custom_languageCode: params.newLanguageCode});
                        sendChangeLanguageEvent(app, read, modify, persistence, rid, http, params.newLanguageCode);
                    }
                }
            }
        }
    }
};

const sendChangeLanguageEvent = async (app: IApp, read: IRead, modify: IModify, persis: IPersistence, rid: string, http: IHttp, languageCode: string) => {
    try {

        const event = { name: 'ChangeLanguage', languageCode, parameters:  {} };
        const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, rid, event, DialogflowRequestType.EVENT);

        await createDialogflowMessage(rid, read, modify, response, app);
      } catch (error) {
        console.error(`${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${rid} } ${getError(error)}`);
        const serviceUnavailable: string = await getLivechatAgentConfig(read, rid, AppSetting.DialogflowServiceUnavailableMessage);
        await createMessage(rid, read, modify, { text: serviceUnavailable }, app);
        return;
    }
};

const logActionPayload = (rid: string, action: IDialogflowAction) => {
    const logData = {dialogflowSessionID: rid, action: JSON.parse(JSON.stringify(action))};
    if (logData.action.params) {
        logData.action.params.customDetail = '';
    }
};

export const  handleResponse = async (app: IApp, read: IRead,  modify: IModify, http: IHttp, persistence: IPersistence, rid: string, visitorToken: string, dialogflowMessage: IDialogflowMessage) => {
    const { messages = [], isFallback = false } = dialogflowMessage;
    for (const message of messages) {
        const { action = null } = message as IDialogflowPayload;
        const textMessages: Array<string | IDialogflowQuickReplies | IDialogflowPayload |  IDialogflowImageCard> = [];
        textMessages.push(message);
        const messagesToProcess: IDialogflowMessage = {
            messages: textMessages,
            isFallback,
        };
        if (action) {
            await handlePayloadActions(app, read, modify, http, persistence, rid, visitorToken, messagesToProcess);
        } else {
            await createDialogflowMessage(rid, read, modify, messagesToProcess, app);
        }
    }
};
