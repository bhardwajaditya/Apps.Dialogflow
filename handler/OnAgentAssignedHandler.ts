import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { DialogflowRequestType, IDialogflowMessage, LanguageCode } from '../enum/Dialogflow';
import { Logs } from '../enum/Logs';
import { Dialogflow } from '../lib/Dialogflow';
import { getError } from '../lib/Helper';
import { createDialogflowMessage, createMessage } from '../lib/Message';
import { getRoomAssoc, retrieveDataByAssociation } from '../lib/Persistence';
import { updateRoomCustomFields } from '../lib/Room';
import { getAppSettingValue } from '../lib/Settings';

export class OnAgentAssignedHandler {
    constructor(private readonly app: IApp,
                private readonly context: ILivechatEventContext,
                private readonly read: IRead,
                private readonly http: IHttp,
                private readonly persis: IPersistence,
                private readonly modify: IModify) {}

    public async run() {
        const { room } = this.context;
        const livechatRoom = room as ILivechatRoom;

        const { id: rid, type, servedBy, isOpen, customFields = {}, visitor: { livechatData, token: visitorToken  } } = livechatRoom;
        const { welcomeEventSent = false } = customFields;

        const DialogflowBotUsername: string = await getAppSettingValue(this.read, AppSetting.DialogflowBotUsername);
        const sendWelcomeEvent = await getAppSettingValue(this.read, AppSetting.DialogflowWelcomeIntentOnStart);
        const sendWelcomeMessage = await getAppSettingValue(this.read, AppSetting.DialogflowEnableWelcomeMessage);

        if (!type || type !== RoomType.LIVE_CHAT) {
            return;
        }

        if (!isOpen || !sendWelcomeEvent) {
            return;
        }

        if (!servedBy || servedBy.username !== DialogflowBotUsername) {
            return;
        }

        if (welcomeEventSent) {
            return;
        }

        if (sendWelcomeMessage) {
            const welcomeMessage: string = await getAppSettingValue(this.read, AppSetting.DialogflowWelcomeMessage);
            await createMessage(rid, this.read, this.modify, { text: welcomeMessage || DefaultMessage.DEFAULT_DialogflowWelcomeMessage });
        }

        await updateRoomCustomFields(rid, { welcomeEventSent: true }, this.read, this.modify);

        const data = await retrieveDataByAssociation(this.read, getRoomAssoc(rid));

        const defaultLanguageCode = await getAppSettingValue(this.read, AppSetting.DialogflowDefaultLanguage);

        try {
            const event = {
                name: 'Welcome',
                languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
                parameters: {...livechatData, roomId: rid, visitorToken} || {},
            };
            const response: IDialogflowMessage = await Dialogflow.sendRequest(this.http, this.read, this.modify, rid, event, DialogflowRequestType.EVENT);

            await createDialogflowMessage(rid, this.read, this.modify, response);
          } catch (error) {
            console.error(Logs.HTTP_REQUEST_ERROR, getError(error));
            this.app.getLogger().error(`${Logs.DIALOGFLOW_REST_API_ERROR} ${error.message}`);

            const serviceUnavailable: string = await getAppSettingValue(this.read, AppSetting.DialogflowServiceUnavailableMessage);

            await createMessage(rid,
                                this.read,
                                this.modify,
                                { text: serviceUnavailable ? serviceUnavailable : DefaultMessage.DEFAULT_DialogflowServiceUnavailableMessage });

            return;
        }
    }
}
