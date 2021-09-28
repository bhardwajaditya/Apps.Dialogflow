import { IHttp, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { AppSetting } from '../config/Settings';
import { Logs } from '../enum/Logs';
import { Dialogflow } from '../lib/Dialogflow';
import { getError } from '../lib/Helper';
import { getAppSettingValue } from '../lib/Settings';

export class OnSettingUpdatedHandler {
    constructor(private readonly app: IApp, private readonly read: IRead, private readonly http: IHttp) {}

    public async run() {
        const dialogflowBotList = JSON.parse(await getAppSettingValue(this.read, AppSetting.DialogflowBotList));

        for (const bot of Object.keys(dialogflowBotList)) {

            const privateKey = dialogflowBotList[bot].private_key;
            const clientEmail = dialogflowBotList[bot].client_email;
            if (clientEmail.length === 0 || privateKey.length === 0) {
                this.app.getLogger().error(Logs.EMPTY_CLIENT_EMAIL_OR_PRIVATE_KEY_SETTING);
                return;
            }

            this.app.getLogger().info(`--- Agent: ${ bot } ---`);
            try {
                await Dialogflow.generateNewAccessToken(this.http, clientEmail, privateKey);
                this.app.getLogger().info(Logs.GOOGLE_AUTH_SUCCESS);
            } catch (error) {
                console.error(Logs.HTTP_REQUEST_ERROR, getError(error));
                this.app.getLogger().error(error.message);
            }
        }
    }
}
