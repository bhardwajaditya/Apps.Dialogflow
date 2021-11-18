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
        try {
            const dialogflowBotList = JSON.parse(await getAppSettingValue(this.read, AppSetting.DialogflowBotList));

            for (const bot of Object.keys(dialogflowBotList)) {

                for (const agentname in dialogflowBotList[bot]) {
                    if (bot[agentname]) {
                        const privateKey = bot[agentname].private_key;
                        const clientEmail = bot[agentname].client_email;

                        if (clientEmail.length === 0 || privateKey.length === 0) {
                            this.app.getLogger().error(Logs.EMPTY_CLIENT_EMAIL_OR_PRIVATE_KEY_SETTING);
                            return;
                        }

                        this.app.getLogger().info(`--- Agent: ${ agentname } ---`);
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
        } catch (e) {
            this.app.getLogger().error(Logs.AGENT_CONFIG_FORMAT_ERROR);
            console.error(Logs.AGENT_CONFIG_FORMAT_ERROR, e);
            throw new Error(e);
        }
    }
}
