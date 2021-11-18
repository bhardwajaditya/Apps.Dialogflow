import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { IDialogflowCustomFields } from '../enum/Dialogflow';
import { createMessage } from '../lib/Message';
import { updateRoomCustomFields } from '../lib/Room';
import { sendWelcomeEventToDialogFlow } from '../lib/sendWelcomeEvent';
import { getLivechatAgentCredentials } from '../lib/Settings';
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

        const sendWelcomeEvent = await getLivechatAgentCredentials(this.read, rid, AppSetting.DialogflowWelcomeIntentOnStart);
        const sendWelcomeMessage = await getLivechatAgentCredentials(this.read, rid, AppSetting.DialogflowEnableWelcomeMessage);

        if (!type || type !== RoomType.LIVE_CHAT) {
            return;
        }

        if (!isOpen || !sendWelcomeEvent) {
            return;
        }

        const dialogflowBotList = JSON.parse(await getAppSettingValue(this.read, AppSetting.DialogflowBotList));
        if (!servedBy || !dialogflowBotList[servedBy.username]) {
            return;
        }

        if (welcomeEventSent) {
            return;
        }

        if (sendWelcomeMessage) {
            const disableInput: IDialogflowCustomFields = {
                disableInput: true,
                disableInputMessage: 'Starting chat...',
                displayTyping: true,
            };
            const welcomeMessage: string = await getLivechatAgentCredentials(this.read, rid, AppSetting.DialogflowWelcomeMessage);
            await createMessage(rid, this.read, this.modify,
                {
                    text: welcomeMessage || DefaultMessage.DEFAULT_DialogflowWelcomeMessage,
                    customFields: disableInput,
                }, this.app);
        }

        await updateRoomCustomFields(rid, { welcomeEventSent: true }, this.read, this.modify);

        await sendWelcomeEventToDialogFlow(this.app, this.read, this.modify, this.persis, this.http, rid, visitorToken, livechatData);
    }
}
