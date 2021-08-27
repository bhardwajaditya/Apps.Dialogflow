import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { ActionIds } from '../enum/ActionIds';
import {  DialogflowRequestType, IDialogflowAction, IDialogflowMessage, IDialogflowPayload, LanguageCode} from '../enum/Dialogflow';
import { JobName } from '../enum/Scheduler';
import { getRoomAssoc, retrieveDataByAssociation } from '../lib/Persistence';
import { closeChat, performHandover, updateRoomCustomFields } from '../lib/Room';
import { sendWelcomeEventToDialogFlow } from '../lib/sendWelcomeEvent';
import { getAppSettingValue } from '../lib/Settings';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage, createMessage } from './Message';

export const  handlePayloadActions = async (app: IApp, read: IRead,  modify: IModify, http: IHttp, persistence: IPersistence, rid: string, visitorToken: string, dialogflowMessage: IDialogflowMessage) => {
    const { messages = [] } = dialogflowMessage;
    for (const message of messages) {
        const { action = null } = message as IDialogflowPayload;
        if (action) {
            const { name: actionName, params } = action as IDialogflowAction;
            const targetDepartment: string = await getAppSettingValue(read, AppSetting.FallbackTargetDepartment);
            if (actionName) {
                if (actionName === ActionIds.PERFORM_HANDOVER) {
                    if (!targetDepartment) {
                        console.error('Failed to handover: Handover Department not configured');
                        return;
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
                    if (!livechatRoom) { throw new Error(); }
                    const { visitor: { livechatData } } = livechatRoom;
                    await sendWelcomeEventToDialogFlow(app, read, modify, persistence, http, rid, visitorToken, livechatData);
                } else if (actionName === ActionIds.SET_TIMEOUT) {

                    const event = { name: params.eventName, languageCode: LanguageCode.EN, parameters: {} };
                    const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, rid, event, DialogflowRequestType.EVENT);

                    const task = {
                        id: JobName.EVENT_SCHEDULER,
                        when: `${Number(params.time)} seconds`,
                        data: {response, rid},
                    };

                    try {
                        await modify.getScheduler().scheduleOnce(task);
                    } catch (error) {
                        const serviceUnavailable: string = await getAppSettingValue(read, AppSetting.DialogflowServiceUnavailableMessage);
                        await createMessage(app, rid, read, modify,
                            { text: serviceUnavailable ? serviceUnavailable : DefaultMessage.DEFAULT_DialogflowServiceUnavailableMessage });
                        return;
                    }

                } else if (actionName === ActionIds.CHANGE_LANGUAGE_CODE) {
                    const assoc = getRoomAssoc(rid);
                    const data = await retrieveDataByAssociation(read, assoc);

                    if (data && data.custom_languageCode) {
                        if (data.custom_languageCode !== params.newLanguageCode) {
                            await persistence.updateByAssociation(assoc, {custom_languageCode: params.newLanguageCode});
                            sendChangeLanguageEvent(app, read, modify, persistence, rid, http, params.newLanguageCode);
                        }
                    } else {
                        await persistence.createWithAssociation({custom_languageCode: params.newLanguageCode}, assoc);
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

        await createDialogflowMessage(app, rid, read, modify, response);
      } catch (error) {

        const serviceUnavailable: string = await getAppSettingValue(read, AppSetting.DialogflowServiceUnavailableMessage);

        await createMessage(app, rid,
                            read,
                            modify,
                            { text: serviceUnavailable ? serviceUnavailable : DefaultMessage.DEFAULT_DialogflowServiceUnavailableMessage });

        return;
    }
};

const logActionPayload = (rid: string, action: IDialogflowAction) => {
    const logData = {dialogflowSessionID: rid, action: JSON.parse(JSON.stringify(action))};
    if (logData.action.params) {
        logData.action.params.customDetail = '';
    }
};
