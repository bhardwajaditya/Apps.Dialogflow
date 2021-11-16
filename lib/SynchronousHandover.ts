import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AgentSettings } from '../enum/AgentSettings';
import { Logs } from '../enum/Logs';
import { createMessage } from '../lib/Message';
import { getLivechatAgentCredentials } from './Dialogflow';
import { performHandover, updateRoomCustomFields } from './Room';

export const incFallbackIntentAndSendResponse = async (app: IApp, read: IRead, modify: IModify, sessionId: string, dialogflowMessage?: () => any) => {
    const fallbackThreshold = (await getLivechatAgentCredentials(read, sessionId, AgentSettings.FALLBACK_RESPONSES_LIMIT)) as number;

    if (!fallbackThreshold || (fallbackThreshold && fallbackThreshold === 0)) { return; }

    const room: ILivechatRoom = await read.getRoomReader().getById(sessionId) as ILivechatRoom;
    if (!room) { throw new Error(Logs.INVALID_ROOM_ID); }

    const { fallbackCount: oldFallbackCount } = room.customFields as any;
    const newFallbackCount: number = oldFallbackCount ? oldFallbackCount + 1 : 1;

    await updateRoomCustomFields(sessionId, { fallbackCount: newFallbackCount }, read, modify);

    if (newFallbackCount === fallbackThreshold) {
        const targetDepartmentName: string | undefined = await getLivechatAgentCredentials(read, sessionId, AgentSettings.FALLBACK_TARGET_DEPARTMENT);

        if (!targetDepartmentName) {
            console.error(Logs.EMPTY_HANDOVER_DEPARTMENT);
            const serviceUnavailable: string = await getLivechatAgentCredentials(read, sessionId, AgentSettings.SERVICE_UNAVAILABLE_MESSAGE);
            return await createMessage(sessionId, read, modify, { text: serviceUnavailable }, app);
        }

        // perform handover
        const { visitor: { token: visitorToken } } = room;
        if (!visitorToken) { throw new Error(Logs.INVALID_VISITOR_TOKEN); }

        // Session Id from Dialogflow will be the same as Room id
        await performHandover(app, modify, read, sessionId, visitorToken, targetDepartmentName, dialogflowMessage);
    } else if (dialogflowMessage) {
        await dialogflowMessage();
    }
};

export const resetFallbackIntent = async (read: IRead, modify: IModify, sessionId: string) => {
    await updateRoomCustomFields(sessionId, { fallbackCount: 0 }, read, modify);
};
