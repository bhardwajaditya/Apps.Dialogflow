import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSetting } from '../../config/Settings';
import { DialogflowRequestType, LanguageCode } from '../../enum/Dialogflow';
import { JobName } from '../../enum/Scheduler';
import { Dialogflow } from '../../lib/Dialogflow';
import { getRoomAssoc, retrieveDataByAssociation } from '../../lib/Persistence';
import { cancelAllSessionMaintenanceJobForSession } from '../../lib/Scheduler';
import { getAppSettingValue } from '../../lib/Settings';
import { SessionMaintenanceOnceSchedule } from './SessionMaintenanceOnceSchedule';

export class SessionMaintenanceProcessor implements IProcessor {
    public id: string;

    constructor(id: string) {
        this.id = id;
    }

    public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        console.log('-----------------------------------JOB----------------------------');
        console.log(jobContext);

        const livechatRoom = await read.getRoomReader().getById(jobContext.sessionId) as ILivechatRoom;
        const { isOpen } = livechatRoom;

        await cancelAllSessionMaintenanceJobForSession(modify, jobContext.sessionId);

        if (!isOpen) {
            return;
        }

        const sessionMaintenanceInterval: string = await getAppSettingValue(read, AppSetting.DialogflowSessionMaintenanceInterval);
        const sessionMaintenanceEventName: string = await getAppSettingValue(read, AppSetting.DialogflowSessionMaintenanceEventName);

        if (!sessionMaintenanceEventName || !sessionMaintenanceInterval) {
            console.log('Session Maintenance Settings not configured');
            return;
        }

        const data = await retrieveDataByAssociation(read, getRoomAssoc(jobContext.sessionId));

        const defaultLanguageCode = await getAppSettingValue(read, AppSetting.DialogflowDefaultLanguage);

        try {
            const eventData = {
                name: sessionMaintenanceEventName,
                languageCode: data.custom_languageCode || defaultLanguageCode || LanguageCode.EN,
            };
            await Dialogflow.sendRequest(http, read, modify, jobContext.sessionId, eventData, DialogflowRequestType.EVENT);
        } catch (error) {
            // console.log(error);
        }

        await modify.getScheduler().scheduleOnce(new SessionMaintenanceOnceSchedule(JobName.SESSION_MAINTENANCE, sessionMaintenanceInterval, {
            sessionId: jobContext.sessionId,
            jobName: JobName.SESSION_MAINTENANCE,
        }));

        return Promise.resolve(undefined);
    }
}
