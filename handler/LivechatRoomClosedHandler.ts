import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { getProcessingAssoc } from '../lib/Persistence';
import { cancelAllSessionMaintenanceJobForSession } from '../lib/Scheduler';

export class LivechatRoomClosedHandler {
    constructor(
        private app: IApp,
        private room: ILivechatRoom,
        private read: IRead,
        private http: IHttp,
        private persistence: IPersistence,
        private modify: IModify,
    ) { }

    public async exec() {
        await cancelAllSessionMaintenanceJobForSession(this.modify, this.room.id);
        await this.persistence.removeByAssociation(getProcessingAssoc(this.room.id));
    }
}
