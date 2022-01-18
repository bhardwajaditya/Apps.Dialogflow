import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSetting } from '../config/Settings';
import { DialogflowRequestType, IDialogflowMessage, LanguageCode } from '../enum/Dialogflow';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage } from './Message';
import { handleResponse } from './payloadAction';
import { getRoomAssoc, retrieveDataByAssociation } from './Persistence';
import { getLivechatAgentConfig } from './Settings';

export class EventScheduler implements IProcessor {
    public id: string;
    private readonly app: IApp;

    constructor(id: string, app: IApp) {
        this.id = id;
        this.app = app;
    }

    public processor = async (jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> => {
        const rid = jobContext.rid;
        const data = await retrieveDataByAssociation(read, getRoomAssoc(rid));

        const defaultLanguageCode = await getLivechatAgentConfig(read, jobContext.rid, AppSetting.DialogflowAgentDefaultLanguage);

        const event = { name: jobContext.eventName, languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN, parameters: {} };
        const response: IDialogflowMessage = (await Dialogflow.sendRequest(http, read, modify, jobContext.rid, event, DialogflowRequestType.EVENT));

        const room = await read.getRoomReader().getById(rid) as ILivechatRoom;
        if (!room || !room.isOpen) { throw new Error('Error! Invalid session Id. No active room found with the given session id'); }
        const { visitor: { token: visitorToken } } = room;

        await handleResponse(this.app, read, modify, http, persis, rid, visitorToken, response );

    }
}
