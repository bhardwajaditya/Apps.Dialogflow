import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { DialogflowRequestType, IDialogflowMessage } from '../enum/Dialogflow';
import { EndpointActionNames, IActionsEndpointContent } from '../enum/Endpoints';
import { Headers, Response } from '../enum/Http';
import { Logs } from '../enum/Logs';
import { Dialogflow } from '../lib/Dialogflow';
import { createHttpResponse } from '../lib/Http';
import { createDialogflowMessage } from '../lib/Message';
import { handlePayloadActions } from '../lib/payloadAction';
import { closeChat, performHandover } from '../lib/Room';
import { getError } from '../lib/Helper';
import { sendWelcomeEventToDialogFlow, WELCOME_EVENT_NAME } from '../lib/sendWelcomeEvent';

export class IncomingEndpoint extends ApiEndpoint {
    public path = 'incoming';

    public async post(request: IApiRequest,
                      endpoint: IApiEndpointInfo,
                      read: IRead,
                      modify: IModify,
                      http: IHttp,
                      persis: IPersistence): Promise<IApiResponse> {
        this.app.getLogger().info(Logs.ENDPOINT_RECEIVED_REQUEST);

        try {
            await this.processRequest(read, modify, persis, http, request.content);
            return createHttpResponse(HttpStatusCode.OK, { 'Content-Type': Headers.CONTENT_TYPE_JSON }, { result: Response.SUCCESS });
        } catch (error) {
            this.app.getLogger().error(Logs.ENDPOINT_REQUEST_PROCESSING_ERROR, error);
            return createHttpResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, { 'Content-Type': Headers.CONTENT_TYPE_JSON }, { error: error.message });
        }
    }

    private async processRequest(read: IRead, modify: IModify, persistence: IPersistence, http: IHttp, endpointContent: IActionsEndpointContent) {

        const { action, sessionId } = endpointContent;
        if (!sessionId) { throw new Error(Logs.INVALID_SESSION_ID); }
        switch (action) {
            case EndpointActionNames.CLOSE_CHAT:
                await closeChat(modify, read, sessionId, persistence);
                break;
            case EndpointActionNames.HANDOVER:
                const { actionData: { targetDepartment = '' } = {} } = endpointContent;
                if (!targetDepartment) {
                    console.error(Logs.EMPTY_HANDOVER_DEPARTMENT);
                    return;
                }
                
                const room = await read.getRoomReader().getById(sessionId) as ILivechatRoom;
                if (!room) { throw new Error(); }
                const { visitor: { token: visitorToken } } = room;
                await performHandover(this.app, modify, read, sessionId, visitorToken, targetDepartment);
                break;
            case EndpointActionNames.TRIGGER_EVENT:
                const { actionData: { event = null } = {} } = endpointContent;
                if (!event) { throw new Error(Logs.INVALID_EVENT_DATA); }

                const livechatRoom = await read.getRoomReader().getById(sessionId) as ILivechatRoom;
                if (!livechatRoom) { throw new Error(); }

                const { visitor: { token: vToken, livechatData } } = livechatRoom;

                if (event && event.name === WELCOME_EVENT_NAME) {
                    await sendWelcomeEventToDialogFlow(this.app, read, modify, persistence, http, sessionId, vToken, livechatData);
                    return;
                }

                try {
                    const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, sessionId, event, DialogflowRequestType.EVENT);
                    await createDialogflowMessage(sessionId, read, modify, response, this.app);
                    await handlePayloadActions(this.app, read, modify, http, persistence, sessionId, vToken, response);
                } catch (error) {
                    this.app.getLogger().error(`${Logs.DIALOGFLOW_REST_API_ERROR} ${getError(error)}`);
                    console.error(`${Logs.DIALOGFLOW_REST_API_ERROR} ${getError(error)}`);
                    throw new Error(`${Logs.DIALOGFLOW_REST_API_ERROR} ${getError(error)}`);
                }
                break;
            case EndpointActionNames.SEND_MESSAGE:
                const { actionData: { messages = null } = {} } = endpointContent;
                if (!messages) { throw new Error(Logs.INVALID_MESSAGES); }
                await createDialogflowMessage(sessionId, read, modify, { messages, isFallback: false }, this.app);
                break;
            default:
                throw new Error(Logs.INVALID_ENDPOINT_ACTION);
        }
    }
}
