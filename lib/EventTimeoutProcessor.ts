import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSetting } from '../config/Settings';
import { DialogflowRequestType, IDialogflowMessage, LanguageCode } from '../enum/Dialogflow';
import { Logs } from '../enum/Logs';
import { getError } from '../lib/Helper';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage } from './Message';
import { getRoomAssoc, retrieveDataByAssociation, setIsProcessingMessage } from './Persistence';
import { getLivechatAgentConfig } from './Settings';

export class EventScheduler implements IProcessor {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }

    public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<void> {
        const sessionId = jobContext.rid;
        try {
            const data = await retrieveDataByAssociation(read, getRoomAssoc(sessionId));
            const defaultLanguageCode = await getLivechatAgentConfig(read, sessionId, AppSetting.DialogflowAgentDefaultLanguage);

            const event = { name: jobContext.eventName, languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN, parameters: {} };
            const response = await Dialogflow.sendRequest(http, read, modify, sessionId, event, DialogflowRequestType.EVENT);

            await createDialogflowMessage(sessionId, read, modify, response);

            // Close blackout window after event is sent
            await setIsProcessingMessage(persistence, sessionId, false);
        } catch (error) {
            // Failed to send event, so close blackout window
            await setIsProcessingMessage(persistence, sessionId, false);
            console.error(`${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${sessionId} } ${getError(error)}`);
        }

    }
}
