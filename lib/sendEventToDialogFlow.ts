import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { AppSetting } from '../config/Settings';
import { DialogflowRequestType, IDialogflowCustomFields, IDialogflowMessage, LanguageCode } from '../enum/Dialogflow';
import { Logs } from '../enum/Logs';
import { getError } from '../lib/Helper';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage, createMessage } from './Message';
import { getRoomAssoc, retrieveDataByAssociation } from './Persistence';
import { getAppSettingValue } from './Settings';

export const sendEventToDialogFlow = async (app: IApp, read: IRead,  modify: IModify, persistence: IPersistence, http: IHttp, rid: string, eventName: string, parameters: any = {}) => {
    try {
        const data = await retrieveDataByAssociation(read, getRoomAssoc(rid));
        const defaultLanguageCode = await getAppSettingValue(read, AppSetting.DialogflowDefaultLanguage);
        const event = {
            name: eventName,
            languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
            parameters: parameters || {},
        };
        const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, rid, event, DialogflowRequestType.EVENT);
        await createDialogflowMessage(rid, read, modify, response, app);
    } catch (error) {
        console.error(`${Logs.DIALOGFLOW_REST_API_ERROR}: { roomID: ${rid} } ${getError(error)}`);
        const serviceUnavailable: string = await getAppSettingValue(read, AppSetting.DialogflowServiceUnavailableMessage);
        await createMessage(rid, read, modify, { text: serviceUnavailable }, app);
        return;
    }
};
