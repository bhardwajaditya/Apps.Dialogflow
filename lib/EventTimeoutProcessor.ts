import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AgentSettings } from '../enum/AgentSettings';
import { DialogflowRequestType, IDialogflowMessage, LanguageCode } from '../enum/Dialogflow';
import { Dialogflow, getLivechatAgentCredentials } from './Dialogflow';
import { createDialogflowMessage } from './Message';
import { getRoomAssoc, retrieveDataByAssociation } from './Persistence';

export class EventScheduler implements IProcessor {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }

    public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {

        const data = await retrieveDataByAssociation(read, getRoomAssoc(jobContext.rid));

        const defaultLanguageCode = await getLivechatAgentCredentials(read, jobContext.rid, AgentSettings.AGENT_DEFAULT_LANGUAGE);

        const event = { name: jobContext.eventName, languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN, parameters: {} };
        const response = await Dialogflow.sendRequest(http, read, modify, jobContext.rid, event, DialogflowRequestType.EVENT);

        await createDialogflowMessage(jobContext.rid, read, modify, response);

    }
}
