import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { JobName } from '../enum/Scheduler';

export const cancelAllSessionMaintenanceJobForSession = async (modify: IModify, sessionId: string) => {
    await modify.getScheduler().cancelJobByDataQuery({ sessionId, jobName: JobName.SESSION_MAINTENANCE });
};

export const cancelAllEventSchedulerJobForSession = async (modify: IModify, sessionId: string) => {
    await modify.getScheduler().cancelJobByDataQuery({ sessionId, jobName: JobName.EVENT_SCHEDULER });
};
