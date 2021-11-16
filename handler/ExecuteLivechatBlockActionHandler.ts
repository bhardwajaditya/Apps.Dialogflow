import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IUIKitResponse, UIKitLivechatBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { UIKitIncomingInteractionContainerType } from '@rocket.chat/apps-engine/definition/uikit/UIKitIncomingInteractionContainer';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { DefaultMessage } from '../config/Settings';
import { ActionIds } from '../enum/ActionIds';
import { AgentSettings } from '../enum/AgentSettings';
import { getLivechatAgentCredentials } from '../lib/Dialogflow';
import { createLivechatMessage, createMessage, deleteAllActionBlocks } from '../lib/Message';
import { closeChat, performHandover } from '../lib/Room';

export class ExecuteLivechatBlockActionHandler {
    constructor(private readonly app: IApp,
                private context: UIKitLivechatBlockInteractionContext,
                private read: IRead,
                private http: IHttp,
                private persistence: IPersistence,
                private modify: IModify) {}

    public async run(): Promise<IUIKitResponse> {
        try {
            const interactionData = this.context.getInteractionData();
            const { visitor, room, container: { id, type }, value, actionId } = interactionData;

            if (type !== UIKitIncomingInteractionContainerType.MESSAGE) {
                return this.context.getInteractionResponder().successResponse();
            }

            const { servedBy: { username = null } = {}, id: rid, isOpen, closedAt } = room as ILivechatRoom;

            if (!isOpen || closedAt) {
                return this.context.getInteractionResponder().errorResponse();
            }

            if (!username ) {
                return this.context.getInteractionResponder().successResponse();
            }

            const appUser = await this.read.getUserReader().getAppUser(this.app.getID()) as IUser;

            switch (actionId) {
                case ActionIds.PERFORM_HANDOVER:
                    const targetDepartment: string = value || await getLivechatAgentCredentials(this.read, rid, AgentSettings.FALLBACK_TARGET_DEPARTMENT);
                    if (!targetDepartment) {
                        await createMessage(rid, this.read, this.modify, { text: DefaultMessage.DEFAULT_DialogflowRequestFailedMessage }, this.app);
                        break;
                    }
                    await performHandover(this.app, this.modify, this.read, rid, visitor.token, targetDepartment);
                    break;

                case ActionIds.CLOSE_CHAT:
                    await closeChat(this.modify, this.read, rid, this.persistence);
                    break;

                default:
                    await createLivechatMessage(this.app, rid, this.read, this.modify, { text: value }, visitor);
                    break;
            }

            const hideQuickRepliesSetting = await getLivechatAgentCredentials(this.read, rid, AgentSettings.HIDE_QUICK_REPLIES);
            if (hideQuickRepliesSetting) {
                await deleteAllActionBlocks(this.modify, appUser, id);
            }

            return this.context.getInteractionResponder().successResponse();
        } catch (error) {
            this.app.getLogger().error(error);
            return this.context.getInteractionResponder().errorResponse();
        }
    }
}
