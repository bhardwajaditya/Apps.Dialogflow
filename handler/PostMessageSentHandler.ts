import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatMessage, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSetting } from '../config/Settings';
import { DialogflowRequestType, IDialogflowMessage, IDialogflowQuickReplies, LanguageCode, Message } from '../enum/Dialogflow';

import { Logs } from '../enum/Logs';
import { botTypingListener, removeBotTypingListener } from '../lib//BotTyping';
import { Dialogflow } from '../lib/Dialogflow';
import { getErrorMessage } from '../lib/Helper';
import { createDialogflowMessage, createMessage, removeQuotedMessage } from '../lib/Message';
import { handlePayloadActions } from '../lib/payloadAction';
import { getRoomAssoc, retrieveDataByAssociation } from '../lib/Persistence';
import { handleParameters } from '../lib/responseParameters';
import { closeChat, performHandover, updateRoomCustomFields } from '../lib/Room';
import { cancelAllSessionMaintenanceJobForSession } from '../lib/Scheduler';
import { sendEventToDialogFlow } from '../lib/sentEventToDialogFlow';
import { agentConfigExists, getLivechatAgentConfig } from '../lib/Settings';
import { getAppSettingValue } from '../lib/Settings';
import { incFallbackIntentAndSendResponse, resetFallbackIntent } from '../lib/SynchronousHandover';
import { handleTimeout } from '../lib/Timeout';

export class PostMessageSentHandler {
    constructor(private readonly app: IApp,
                private readonly message: ILivechatMessage,
                private readonly read: IRead,
                private readonly http: IHttp,
                private readonly persistence: IPersistence,
                private readonly modify: IModify) { }

    public async run() {

        const { text, editedAt, room, token, sender, customFields, file } = this.message;
        const livechatRoom = room as ILivechatRoom;

        const { id: rid, type, servedBy, isOpen, customFields: roomCustomFields,
            visitor: { token: visitorToken, username: visitorUsername }} = livechatRoom;

        if (!servedBy) {
            return;
        }

        const agentExists = await(agentConfigExists(this.read, servedBy.username));

        if (!agentExists) {
            return;
        }

        if (text === Message.CLOSED_BY_VISITOR) {
            if (roomCustomFields && roomCustomFields.isHandedOverFromDialogFlow === true) {
                return;
            }
            await cancelAllSessionMaintenanceJobForSession(this.modify, rid);
            await this.handleClosedByVisitor(rid, this.read);
        }

        if (text === Message.CUSTOMER_IDEL_TIMEOUT) {
            if (roomCustomFields && roomCustomFields.isHandedOverFromDialogFlow === true) {
                return;
            }
            await this.handleClosedByVisitor(rid, this.read);
            await closeChat(this.modify, this.read, rid, this.persistence);
            return;
        }

        if (!type || type !== RoomType.LIVE_CHAT) {
            return;
        }

        if (!isOpen) {
            return;
        }

        if (customFields) {
            const { disableInput, displayTyping } = customFields;
            if (disableInput === true && displayTyping !== true) {
                await removeBotTypingListener(this.modify, rid, servedBy.username);
            }
        }

        if (file && sender.username === visitorUsername) {
            const fileAttachmentEventName: string = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowFileAttachmentEventName);
            await sendEventToDialogFlow(this.app, this.read, this.modify, this.persistence, this.http, rid, fileAttachmentEventName);
            return;
        }

        if (!text || (text && text.trim().length === 0) || editedAt) {
            return;
        }

        let messageText = text;
        messageText = await removeQuotedMessage(this.read, room, messageText);

        await handleTimeout(this.app, this.message, this.read, this.http, this.persistence, this.modify);

        if (sender.username === servedBy.username) {
            return;
        }

        let response: IDialogflowMessage;

        try {
            await botTypingListener(this.modify, rid, servedBy.username);
            response = (await Dialogflow.sendRequest(this.http, this.read, this.modify, rid, messageText, DialogflowRequestType.MESSAGE));
        } catch (error) {
            const errorContent = `${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${rid} } ${getErrorMessage(error)}`;
            this.app.getLogger().error(errorContent);
            console.error(errorContent);

            const serviceUnavailable: string = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowServiceUnavailableMessage);
            await createMessage(rid, this.read, this.modify, { text: serviceUnavailable }, this.app);

            const targetDepartment: string = await getLivechatAgentConfig(this.read, rid, AppSetting.FallbackTargetDepartment);
            if (!targetDepartment) {
                console.error(Logs.EMPTY_HANDOVER_DEPARTMENT);
                return;
            }

            updateRoomCustomFields(rid, { isChatBotFunctional: false }, this.read, this.modify);
            await performHandover(this.app, this.modify, this.read, rid, visitorToken, targetDepartment);

            return;
        }

        const createResponseMessage = async () => await createDialogflowMessage(rid, this.read, this.modify, response, this.app);

        // synchronous handover check
        const { isFallback } = response;
        if (isFallback) {
            await removeBotTypingListener(this.modify, rid, servedBy.username);
            return incFallbackIntentAndSendResponse(this.app, this.read, this.modify, rid, createResponseMessage);
        }

        await createResponseMessage();
        await handlePayloadActions(this.app, this.read, this.modify, this.http, this.persistence, rid, visitorToken, response);
        await handleParameters(this.app, this.read, this.modify, this.persistence, this.http, rid, visitorToken, response);
        await this.handleBotTyping(rid, response);

        return resetFallbackIntent(this.read, this.modify, rid);
    }

    private async handleBotTyping(rid: string, dialogflowMessage: IDialogflowMessage) {
        const { messages = [] } = dialogflowMessage;
        let removeTypingIndicator = true;

        for (const message of messages) {
            const { customFields = null } = message as IDialogflowQuickReplies;

            if (customFields) {
                const { disableInput, displayTyping } = customFields;
                if (disableInput === true && displayTyping === true) {
                    removeTypingIndicator = false;
                }
            }
        }

        if (removeTypingIndicator) {
            await this.removeBotTypingListener(this.read, rid);
        }
    }

    private async handleClosedByVisitor(rid: string, read: IRead) {
        const DialogflowEnableChatClosedByVisitorEvent = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowEnableChatClosedByVisitorEvent);
        const DialogflowChatClosedByVisitorEventName = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowChatClosedByVisitorEventName);
        await this.removeBotTypingListener(read, rid);

        const data = await retrieveDataByAssociation(read, getRoomAssoc(rid));
        if (DialogflowEnableChatClosedByVisitorEvent) {
            try {
                const defaultLanguageCode = LanguageCode[await getLivechatAgentConfig(read, rid, AppSetting.DialogflowAgentDefaultLanguage)];

                let res: IDialogflowMessage;
                res = (await Dialogflow.sendRequest(this.http, this.read, this.modify,  rid, {
                    name: DialogflowChatClosedByVisitorEventName,
                    languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
                }, DialogflowRequestType.EVENT));
            } catch (error) {
                const errorContent = `${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${rid} } ${getErrorMessage(error)}`;
                this.app.getLogger().error(errorContent);
                console.error(errorContent);
            }
        }
    }

    private async removeBotTypingListener(read: IRead, rid: string) {
        const room = await read.getRoomReader().getById(rid) as any;
        const DialogflowBotUsername = room.servedBy.username;
        await removeBotTypingListener(this.modify, rid, DialogflowBotUsername);
    }
}
