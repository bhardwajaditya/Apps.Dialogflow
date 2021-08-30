import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { AppSetting } from '../config/Settings';
import {  DialogflowRequestType, IDialogflowMessage} from '../enum/Dialogflow';
import { getRoomAssoc, retrieveDataByAssociation } from '../lib/Persistence';
import { getAppSettingValue } from '../lib/Settings';
import { Dialogflow } from './Dialogflow';
import { createDialogflowMessage, createMessage } from './Message';

export const  handleParameters = async (app: IApp, read: IRead,  modify: IModify, persistence: IPersistence, http: IHttp, rid: string, visitorToken: string, dialogflowMessage: IDialogflowMessage) => {
    const { parameters = [] } = dialogflowMessage;

    if (parameters.custom_languagecode) {

        const assoc = getRoomAssoc(rid);
        const data = await retrieveDataByAssociation(read, assoc);

        if (data && data.custom_languageCode) {
            if (data.custom_languageCode !== parameters.custom_languagecode) {
                await persistence.updateByAssociation(assoc, {custom_languageCode: parameters.custom_languagecode});
                sendChangeLanguageEvent(app, read, modify, persistence, rid, http, parameters.custom_languagecode);
            }
        } else {
            await persistence.createWithAssociation({custom_languageCode: parameters.custom_languagecode}, assoc);
            sendChangeLanguageEvent(app, read, modify, persistence, rid, http, parameters.custom_languagecode);
        }

    }
};

const sendChangeLanguageEvent = async (app: IApp, read: IRead, modify: IModify, persis: IPersistence, rid: string, http: IHttp, languageCode: string) => {
    try {

        const event = { name: 'ChangeLanguage', languageCode, parameters:  {} };
        const response: IDialogflowMessage = await Dialogflow.sendRequest(http, read, modify, rid, event, DialogflowRequestType.EVENT);

        await createDialogflowMessage(rid, read, modify, response, app);
      } catch (error) {

        const serviceUnavailable: string = await getAppSettingValue(read, AppSetting.DialogflowServiceUnavailableMessage);

        await createMessage(rid, read, modify, { text: serviceUnavailable }, app);

        return;
    }
};
