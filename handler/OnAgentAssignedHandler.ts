import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { IDialogflowCustomFields } from '../enum/Dialogflow';
import { createMessage } from '../lib/Message';
import { sendWelcomeEventToDialogFlow } from '../lib/payloadAction';
import { assignPersistentAgentConfigToRoom } from '../lib/Persistence';
import { updateRoomCustomFields } from '../lib/Room';
import { agentConfigExists, getLivechatAgentConfig } from '../lib/Settings';

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

        const agentConfig = await getLivechatAgentConfig(this.read, rid);
        assignPersistentAgentConfigToRoom(this.read, this.persis, rid, agentConfig);

        const sendWelcomeEvent = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowWelcomeIntentOnStart);
        const sendWelcomeMessage = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowEnableWelcomeMessage);

        const disableComposerOnTriggerEvent = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowDisableComposerOnTriggerEvent);

        if (!type || type !== RoomType.LIVE_CHAT) {
            return;
        }

        if (!disableComposerOnTriggerEvent) {
            const enableInput: IDialogflowCustomFields = {
                disableInput: false,
            };
            await createMessage(rid, this.read, this.modify,
                {
                    customFields: enableInput,
                }, this.app);
        }

        if (!isOpen || !sendWelcomeEvent) {
            return;
        }

        if (!servedBy || !agentConfigExists(this.read, servedBy.username)) {
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
            const welcomeMessage: string = await getLivechatAgentConfig(this.read, rid, AppSetting.DialogflowWelcomeMessage);
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
