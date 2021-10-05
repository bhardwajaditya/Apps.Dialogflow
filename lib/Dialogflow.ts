import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { createSign } from 'crypto';
import { AppSetting } from '../config/Settings';
import { DialogflowJWT, DialogflowRequestType, DialogflowUrl, IDialogflowAccessToken, IDialogflowCustomFields, IDialogflowEvent, IDialogflowMessage, IDialogflowPayload, IDialogflowQuickReplies, LanguageCode } from '../enum/Dialogflow';
import { Headers } from '../enum/Http';
import { Logs } from '../enum/Logs';
import { base64urlEncode, getError } from './Helper';
import { createHttpRequest } from './Http';
import { getRoomAssoc, retrieveDataByAssociation } from './Persistence';
import { updateRoomCustomFields } from './Room';
import { getAppSettingValue } from './Settings';

class DialogflowClass {
    private jwtExpiration: Date;
    public async sendRequest(http: IHttp,
                             read: IRead,
                             modify: IModify,
                             sessionId: string,
                             request: IDialogflowEvent | string,
                             requestType: DialogflowRequestType): Promise<any> {

        const room = await read.getRoomReader().getById(sessionId) as ILivechatRoom;
        const { id: rid, visitor: { livechatData, token: visitorToken  } } = room;

        const serverURL = await this.getServerURL(read, modify, http, sessionId);

        const data = await retrieveDataByAssociation(read, getRoomAssoc(sessionId));

        const defaultLanguageCode = await this.getLivechatAgentCredentials(read, rid, 'agent_default_language');
        const dialogFlowVersion = await this.getLivechatAgentCredentials(read, sessionId, 'version');

        if (dialogFlowVersion === 'CX') {

            const queryInput = {
                ...requestType === DialogflowRequestType.EVENT && { event: { event: typeof request === 'string' ? request : request.name} },
                ...requestType === DialogflowRequestType.MESSAGE && { text: { text: request }},
                languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
            };

            const queryParams = {
                timeZone: 'America/Los_Angeles',
                parameters:  {
                    username: room.visitor.username,
                    roomId: rid,
                    visitorToken,
                    ...(livechatData || {}),
                },
            };

            if (requestType === DialogflowRequestType.EVENT && typeof request !== 'string') {
                queryParams.parameters = {...queryParams.parameters, ...(request.parameters ? request.parameters : {})};
            }

            const accessToken = await this.getAccessToken(read, modify, http, sessionId);
            if (!accessToken) { throw Error(Logs.ACCESS_TOKEN_ERROR); }

            const httpRequestContent: IHttpRequest = createHttpRequest(
                { 'Content-Type': Headers.CONTENT_TYPE_JSON, 'Accept': Headers.ACCEPT_JSON, 'Authorization': 'Bearer ' + accessToken },
                { queryInput, queryParams },
            );

            try {
                const response = await http.post(serverURL, httpRequestContent);
                return await this.parseCXRequest(read, response.data, sessionId);
            } catch (error) {
                const errorContent = `${Logs.HTTP_REQUEST_ERROR}: { roomID: ${sessionId} } ${getError(error)}`;
                console.error(errorContent);
                throw new Error(error);
            }
        } else {

            const queryInput = {
                ...requestType === DialogflowRequestType.EVENT && { event: request },
                ...requestType === DialogflowRequestType.MESSAGE && { text:
                    {
                        languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
                        text: request,
                    },
                },
            };

            const httpRequestContent: IHttpRequest = createHttpRequest(
                { 'Content-Type': Headers.CONTENT_TYPE_JSON, 'Accept': Headers.ACCEPT_JSON},
                { queryInput },
            );

            try {
                const response = await http.post(serverURL, httpRequestContent);
                return this.parseRequest(response.data, sessionId);
            } catch (error) {
                const errorContent = `${Logs.HTTP_REQUEST_ERROR}: { roomID: ${sessionId} } ${getError(error)}`;
                console.error(errorContent);
                throw new Error(error);
            }
        }
    }

    public async generateNewAccessToken(http: IHttp, clientEmail: string, privateKey: string, sessionId?: string): Promise<IDialogflowAccessToken> {
        const authUrl = DialogflowUrl.AUTHENTICATION_SERVER_URL;
        const jwt = this.getJWT(clientEmail, privateKey);

        const httpRequestContent: IHttpRequest = {
            headers: {
                'Content-Type': Headers.CONTENT_TYPE_X_FORM_URL_ENCODED,
            },
            content: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        };

        try {
            const response = await http.post(authUrl, httpRequestContent);

            if (!response.content) {
                const errorContent = `${Logs.INVALID_RESPONSE_FROM_DIALOGFLOW}: { roomID: ${sessionId || 'N/A'} }`;
                console.error(errorContent);
                throw new Error(errorContent);
            }
            const responseJSON = JSON.parse(response.content);

            const { access_token } = responseJSON;
            if (access_token) {
                const accessToken: IDialogflowAccessToken = {
                    token: access_token,
                    expiration: this.jwtExpiration,
                };
                return accessToken;
            } else {
                const { error, error_description } = responseJSON;
                if (error) {
                    throw Error(`\
                    ---------------------Error with Google Credentials-------------------\
                    Details:- \
                        Error Message:- ${error} \
                        Error Description:- ${error_description}`);
                }
                throw Error(Logs.ACCESS_TOKEN_ERROR);
            }
        } catch (error) {
            const errorContent = `${Logs.HTTP_REQUEST_ERROR}: { roomID: ${sessionId || 'N/A'} } ${getError(error)}`;
            console.error(errorContent);
            throw new Error(error);
        }
    }

    public parseRequest(response: any, sessionId?: string): IDialogflowMessage {
        if (!response) {
            const errorContent = `${Logs.INVALID_RESPONSE_FROM_DIALOGFLOW_CONTENT_UNDEFINED}: { roomID: ${sessionId || 'N/A'} }`;
            console.error(errorContent);
            throw new Error(errorContent);
        }

        const { session, queryResult } = response;
        if (queryResult) {
            const { fulfillmentMessages, intent: { isFallback } } = queryResult;
            const parsedMessage: IDialogflowMessage = {
                isFallback: isFallback ? isFallback : false,
            };

            const messages: Array<string | IDialogflowQuickReplies | IDialogflowPayload> = [];
            // customFields should be sent as the response of last message on client side
            const msgCustomFields: IDialogflowCustomFields = {};

            fulfillmentMessages.forEach((message) => {
                const { text, payload: { quickReplies = null, customFields = null, action = null } = {} } = message;
                if (text) {
                    const { text: textMessageArray } = text;
                    messages.push({ text: textMessageArray[0] });
                }
                if (quickReplies) {
                    const { options, imagecards } = quickReplies;
                    if (options || imagecards) {
                        messages.push(quickReplies);
                    }
                }
                if (customFields) {
                    msgCustomFields.disableInput = !!customFields.disableInput;
                    msgCustomFields.disableInputMessage = customFields.disableInputMessage;
                    msgCustomFields.displayTyping = customFields.displayTyping;
                }
                if (action) {
                    messages.push({action});
                }
            });

            if (Object.keys(msgCustomFields).length > 0) {
                if (messages.length > 0) {
                    let lastObj = messages[messages.length - 1];
                    lastObj = Object.assign(lastObj, { customFields: msgCustomFields });
                    messages[messages.length - 1] = lastObj;
                } else {
                    messages.push({ customFields: msgCustomFields });
                }
            }

            if (messages.length > 0) {
                parsedMessage.messages = messages;
            }

            if (session) {
                // "session" format -> projects/project-id/agent/sessions/session-id
                const splittedText: Array<string> = session.split('/');
                const dfSessionId: string = splittedText[splittedText.length - 1];
                if (dfSessionId) {
                    parsedMessage.sessionId = dfSessionId;
                }
            }

            return parsedMessage;
        } else {
            // some error occurred. Dialogflow's response has a error field containing more info abt error
            throw Error(`An Error occurred while connecting to Dialogflow's REST API\
            Error Details:-
                message:- ${response.error.message}\
                status:- ${response.error.message}\
            Try checking the google credentials in App Setting and your internet connection`);
        }
    }

    public async parseCXRequest(read: IRead, response: any, sessionId: string): Promise<IDialogflowMessage> {
        if (!response) {
            const errorContent = `${Logs.INVALID_RESPONSE_FROM_DIALOGFLOW_CONTENT_UNDEFINED}: { roomID: ${sessionId} }`;
            console.error(errorContent);
            throw new Error(errorContent);
        }

        const { session, queryResult } = response;

        if (queryResult) {
            const { responseMessages, match: { matchType }, diagnosticInfo } = queryResult;

            // Check array of event names from app settings for fallbacks
            const parsedMessage: IDialogflowMessage = {
                isFallback: false,
            };

            const messages: Array<string | IDialogflowQuickReplies | IDialogflowPayload> = [];
            // customFields should be sent as the response of last message on client side
            const msgCustomFields: IDialogflowCustomFields = {};

            let intentConcatText = '';
            let pageConcatText = '';

            if (responseMessages) {
                responseMessages.forEach((message) => {
                    const { text, payload: { quickReplies = null, customFields = null, action = null, isFallback = false } = {} } = message;
                    if (text) {
                        const { text: textMessageArray } = text;

                        const sourceType = this.getSourceType(text, diagnosticInfo);

                        if (sourceType === 'intent') {
                            if (intentConcatText !== '') {
                                intentConcatText += `\n \n`;
                            }
                            intentConcatText += textMessageArray[0];
                        } else {
                            if (pageConcatText !== '') {
                                pageConcatText += `\n \n`;
                            }
                            pageConcatText += textMessageArray[0];
                        }
                    }
                    if (quickReplies) {
                        const { options, imagecards } = quickReplies;
                        if (options || imagecards) {
                            messages.push(quickReplies);
                        }
                    }
                    if (customFields) {
                        msgCustomFields.disableInput = !!customFields.disableInput;
                        msgCustomFields.disableInputMessage = customFields.disableInputMessage;
                        msgCustomFields.displayTyping = customFields.displayTyping;
                    }

                    if (customFields && customFields.mediaCardURL) {
                        const { mediaCardURL } = customFields;
                        messages.push({ customFields: { mediaCardURL } });
                    }
                    if (action) {
                        messages.push({action});
                    }
                    if (isFallback) {
                        parsedMessage.isFallback = isFallback;
                    }
                });

                if (intentConcatText !== '') {
                    messages.push({ text: intentConcatText });
                }
                if (pageConcatText !== '') {
                    messages.push({ text: pageConcatText });
                }
            }

            if (Object.keys(msgCustomFields).length > 0) {

                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].hasOwnProperty('text')) {
                        let lastObj = messages[i];
                        lastObj = Object.assign(lastObj, { customFields: msgCustomFields });
                        messages[i] = lastObj;
                        break;
                    }
                    if (i === 0) {
                        messages.push({ customFields: msgCustomFields });
                    }
                }
                if (messages.length === 0) {
                    messages.push({ customFields: msgCustomFields });
                }
            }

            if (messages.length > 0) {
                parsedMessage.messages = messages;
            }

            if (session) {
                // "session" format -> projects/project-id/agent/sessions/session-id
                const splittedText: Array<string> = session.split('/');
                const dfSessionId: string = splittedText[splittedText.length - 1];
                if (dfSessionId) {
                    parsedMessage.sessionId = dfSessionId;
                }
            }

            parsedMessage.parameters = queryResult.parameters;

            return parsedMessage;
        } else {
            // some error occurred. Dialogflow's response has a error field containing more info abt error
            throw Error(`An Error occurred while connecting to Dialogflow's REST API\
            Error Details:-
                message:- ${response.error.message}\
                status:- ${response.error.message}\
            Try checking the google credentials in App Setting and your internet connection`);
        }
    }

    public async getLivechatAgentCredentials(read: IRead, sessionId: string, type: string) {

        try {
            const dialogflowBotList = JSON.parse(await getAppSettingValue(read, AppSetting.DialogflowBotList));
            const room = await read.getRoomReader().getById(sessionId) as any;
            const agentName = room.servedBy.username;

            if (!dialogflowBotList[agentName]) {
                console.error(Logs.NO_AGENT_IN_CONFIG_WITH_CURRENT_AGENT_NAME, agentName);
                throw Error(`Agent ${ agentName } not found in Dialogflow Agent Endpoints`);
            }
            return dialogflowBotList[agentName][type];

        } catch (e) {
            console.error(Logs.AGENT_CONFIG_FORMAT_ERROR);
            throw new Error(e);
        }

    }

    private async getServerURL(read: IRead, modify: IModify, http: IHttp, sessionId: string) {
        const projectId = await this.getLivechatAgentCredentials(read, sessionId, 'project_id');
        const environment = await this.getLivechatAgentCredentials(read, sessionId, 'environment');
        const dialogFlowVersion = await this.getLivechatAgentCredentials(read, sessionId, 'version');

        if (dialogFlowVersion === 'CX') {

            const regionId = await this.getLivechatAgentCredentials(read, sessionId, 'agent_region');
            const agentId = await this.getLivechatAgentCredentials(read, sessionId, 'agent_id');

            return `https://${regionId}-dialogflow.googleapis.com/v3/projects/${projectId}/locations/${regionId}/agents/${agentId}/sessions/${sessionId}:detectIntent`;
        }

        const accessToken = await this.getAccessToken(read, modify, http, sessionId);
        if (!accessToken) { throw Error(Logs.ACCESS_TOKEN_ERROR); }
        return `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/environments/${environment || 'draft'}/users/-/sessions/${sessionId}:detectIntent?access_token=${accessToken}`;
    }

    private async getAccessToken(read: IRead, modify: IModify, http: IHttp, sessionId: string) {

        const privateKey = await this.getLivechatAgentCredentials(read, sessionId, 'private_key');
        const clientEmail = await this.getLivechatAgentCredentials(read, sessionId, 'client_email');

        if (!privateKey || !clientEmail) { throw new Error(Logs.EMPTY_CLIENT_EMAIL_OR_PRIVATE_KEY_SETTING); }

        const room: IRoom = await read.getRoomReader().getById(sessionId) as IRoom;
        if (!room) { throw new Error(Logs.INVALID_ROOM_ID); }

        // check is there is a valid access token already present
        const { customFields } = room;
        if (customFields) {
            const { accessToken: oldAccessToken } = customFields as any;
            if (oldAccessToken) {
                // check expiration
                if (!this.hasExpired(oldAccessToken.expiration)) {
                    return oldAccessToken.token;
                }
            }
        }

        try {
            // get a new access token
            const accessToken: IDialogflowAccessToken =  await this.generateNewAccessToken(http, clientEmail, privateKey, sessionId);

            // save this access Token for future use
            await updateRoomCustomFields(sessionId, { accessToken }, read, modify);

            return accessToken.token;
        } catch (error) {
            console.error(Logs.ACCESS_TOKEN_ERROR, error);
            throw Error(Logs.ACCESS_TOKEN_ERROR + error);
        }
    }

    private hasExpired(expiration: Date): boolean {
        if (!expiration) { return true; }
        return Date.now() >= expiration.getTime();
    }

    private getJWT(clientEmail, privateKey) {
        // request format
        // {Base64url encoded header}.{Base64url encoded claim set}.{Base64url encoded signature}

        const header = this.getJWTHeader();
        const claimSet = this.getClaimSet(clientEmail);
        const signature = this.getSignature(header, claimSet, privateKey);
        // combining all together to form jwt
        return `${ header }.${ claimSet }.${ signature }`;
    }

    // Forming the JWT header
    private getJWTHeader() {
        return base64urlEncode(DialogflowJWT.JWT_HEADER);
    }

    // Forming the jwt claim set
    private getClaimSet(clientEmail) {

        let currentUnixTime = Date.now();
        const hourInc = 1000 * 60 * 30; // an hour
        let oneHourInFuture = currentUnixTime + hourInc;
        // record the expiration date-time
        this.jwtExpiration = new Date(oneHourInFuture);

        // convert milliseconds to seconds
        currentUnixTime = Math.round(currentUnixTime / 1000);
        oneHourInFuture = Math.round(oneHourInFuture / 1000);

        const jwtClaimSet = {
            iss: clientEmail,
            scope: DialogflowJWT.SCOPE_URL,
            aud: DialogflowJWT.AUD_URL,
            exp: oneHourInFuture,
            iat: currentUnixTime,
        };

        return base64urlEncode(JSON.stringify(jwtClaimSet));
    }

    private getSignature(b64uHeader: string, b64uClaimSetClaimSet: string, privateKey) {
        const signatureInput = `${b64uHeader}.${b64uClaimSetClaimSet}`;
        const sign = createSign(DialogflowJWT.SHA_256);
        sign.update(signatureInput);
        // replace \\n by \n in private key
        privateKey = privateKey.trim().replace(/\\n/gm, '\n');
        // sign the signature then in the result replace + with -    |    / with _
        return sign.sign(privateKey, DialogflowJWT.BASE_64).replace(/\+/g, '-').replace(/\//g, '_');
    }

    private getSourceType(text: any, info: any) {
        const executionStep = info['Execution Sequence'][2] ? info['Execution Sequence'][2]['Step 3'] : info['Execution Sequence'][1]['Step 2'];

        if (executionStep) {

            const intentResponses = executionStep.FunctionExecution ? executionStep.FunctionExecution.Responses : null;

            if (intentResponses) {
                for (const response of intentResponses) {
                    if (response.text && response.text.text[0] === text.text[0] && response.responseType === 'HANDLER_PROMPT') {
                        return 'intent';
                    }
                }
            }
        }

        return 'page';
    }
}

export const Dialogflow = new DialogflowClass();
