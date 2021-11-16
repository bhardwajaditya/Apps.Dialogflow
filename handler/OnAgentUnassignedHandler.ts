import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSetting, DefaultMessage } from '../config/Settings';
import { AgentSettings } from '../enum/AgentSettings';
import { Logs } from '../enum/Logs';
import { removeBotTypingListener } from '../lib//BotTyping';
import { getLivechatAgentCredentials } from '../lib/Dialogflow';
import { createMessage } from '../lib/Message';
import { cancelAllSessionMaintenanceJobForSession } from '../lib/Scheduler';
import { getAppSettingValue } from '../lib/Settings';

export class OnAgentUnassignedHandler {
    constructor(private readonly app: IApp,
                private readonly context: ILivechatEventContext,
                private readonly read: IRead,
                private readonly http: IHttp,
                private readonly persist: IPersistence,
                private readonly modify: IModify) {}

    public async run() {
        const livechatRoom: ILivechatRoom = this.context.room as ILivechatRoom;
        const { isChatBotFunctional: allowChatBotSession } = this.context.room.customFields as any;
        const {id: rid} = livechatRoom;

        if (!livechatRoom.servedBy) {
            return;
        }

        await removeBotTypingListener(this.modify, rid, livechatRoom.servedBy.username);

        const dialogflowBotList = JSON.parse(await getAppSettingValue(this.read, AppSetting.DialogflowBotList));

        if (dialogflowBotList[livechatRoom.servedBy.username] && allowChatBotSession === false) {
                const offlineMessage: string = await getLivechatAgentCredentials(this.read, rid, AgentSettings.SERVICE_UNAVAILABLE_MESSAGE);

                await createMessage(livechatRoom.id, this.read, this.modify, { text: offlineMessage }, this.app);

                await closeChat(this.modify, this.read, rid);
            }

        return;
    }
}

export const closeChat = async (modify: IModify, read: IRead, rid: string) => {
    await cancelAllSessionMaintenanceJobForSession(modify, rid);
    const room = (await read.getRoomReader().getById(rid)) as any;
    if (!room) { throw new Error(Logs.INVALID_ROOM_ID); }

    const DialogflowBotUsername = room.servedBy.username;
    await removeBotTypingListener(modify, rid, DialogflowBotUsername);

    const closeChatMessage = await getLivechatAgentCredentials(read, rid, AgentSettings.CLOSE_CHAT_MESSAGE);

    const result = await modify.getUpdater().getLivechatUpdater()
                                .closeRoom(room, closeChatMessage ? closeChatMessage : DefaultMessage.DEFAULT_DialogflowCloseChatMessage);
    if (!result) { throw new Error(Logs.CLOSE_CHAT_REQUEST_FAILED_ERROR); }
};
