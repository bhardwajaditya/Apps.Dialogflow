import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSetting } from '../config/Settings';
import { DialogflowRequestType, LanguageCode } from '../enum/Dialogflow';
import { Logs } from '../enum/Logs';
import { Global } from '../Global';
import { getError } from '../lib/Helper';
import { Dialogflow } from './Dialogflow';
import { handleResponse } from './payloadAction';
import { getQueuedMessage, getRoomAssoc, retrieveDataByAssociation, setIsProcessingMessage, setIsQueueWindowActive, setQueuedMessage } from './Persistence';
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

            // Start queue window
            await setIsQueueWindowActive(read, persistence, sessionId, true);
            console.debug({rid: sessionId}, `Queue Window started`);

            const response = await Dialogflow.sendRequest(http, read, modify, sessionId, event, DialogflowRequestType.EVENT);

            const livechatRoom = await read.getRoomReader().getById(sessionId) as ILivechatRoom;
            if (!livechatRoom) { throw new Error(Logs.INVALID_ROOM_ID); }

            const { visitor: { token: visitorToken } } = livechatRoom;

            // Close blackout window after event is sent
            await setIsProcessingMessage(read, persistence, sessionId, false);

            // Handling response after closing previous window so that we can start new window if any properly
            await handleResponse(Global.app, read, modify, http, persistence, sessionId, visitorToken, response);

            const queuedMessage = await getQueuedMessage(read, sessionId);

            await setIsQueueWindowActive(read, persistence, sessionId, false);
            await setQueuedMessage(read, persistence, sessionId, '');
            console.debug({rid: sessionId}, `Queue Window closed`);

            // Send Queued Message
            if (queuedMessage) {
                try {
                    const messageResponse = await Dialogflow.sendRequest(http, read, modify, sessionId, queuedMessage, DialogflowRequestType.MESSAGE);
                    await handleResponse(Global.app, read, modify, http, persistence, sessionId, visitorToken, messageResponse);
                } catch (error) {
                    console.error(`${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${sessionId} } ${getError(error)}`);
                }
            }
        } catch (error) {
            // Failed to send event, so close blackout window
            await setIsProcessingMessage(read, persistence, sessionId, false);
            console.error(`${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${sessionId} } ${getError(error)}`);
        }

    }
}
