import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { AppSetting } from '../config/Settings';
import { Logs } from '../enum/Logs';

export const getAppSettingValue = async (read: IRead, id: string) => {
    return id && await read.getEnvironmentReader().getSettings().getValueById(id);
};

export const getServerSettingValue = async (read: IRead, id: string) => {
    return id && (await read.getEnvironmentReader().getServerSettings().getValueById(id));
};

export const getLivechatAgentCredentials = async (read: IRead, sessionId: string, type: string) => {

    try {

        const dialogflowBotList = JSON.parse(await getAppSettingValue(read, AppSetting.DialogflowBotList));
        const room = await read.getRoomReader().getById(sessionId) as any;
        const agentName = room.servedBy.username;

        for (const dialogflowBot of dialogflowBotList) {
            if (dialogflowBot[agentName]) {
                return dialogflowBot[agentName][type];
            }
        }
        console.error(Logs.NO_AGENT_IN_CONFIG_WITH_CURRENT_AGENT_NAME, agentName);
        throw Error(`Agent ${ agentName } not found in Dialogflow Agent Endpoints`);

    } catch (e) {
        console.error(Logs.AGENT_CONFIG_FORMAT_ERROR);
        throw new Error(e);
    }

};
