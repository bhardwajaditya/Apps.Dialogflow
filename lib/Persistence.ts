import { IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { getLivechatAgentConfig } from './Settings';

export const getRoomAssoc = (rid: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `DF-RID-${rid}`);

/**
 * This Association is used to store data related to the session.
 * isProcessingMessage: It is used to store the boolean if the previous message is currently being processed or not.
 */
export const getProcessingAssoc = (rid: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `DF-PROCESSING-${rid}`);

export const retrieveDataByAssociation = async (read: IRead,  assoc: RocketChatAssociationRecord) => {

    const association = await read.getPersistenceReader().readByAssociation(assoc);

    if (association.length > 0) {
        return Object.assign.apply(Object, association);
    }

    return {};
};

export async function updatePersistentData(read: IRead, persistence: IPersistence,  assoc: RocketChatAssociationRecord, data: object) {
    try {
        const persistentData = await retrieveDataByAssociation(read, assoc);
        const updatedData = {
            ...persistentData,
            ...data,
        };
        await persistence.updateByAssociation(assoc, updatedData, true);
    } catch (error) {
        throw new Error(error);
    }
}

export async function assignPersistentAgentConfigToRoom(read: IRead, persistence: IPersistence, rid: string, agentConfig: object) {
    try {
        const assoc = getRoomAssoc(rid);
        const data = {
            roomAgentConfigs: {
                [rid]: agentConfig,
            },
        };

        await updatePersistentData(read, persistence, assoc, data);
    } catch (e) {
        throw new Error(e);
    }
}

export async function getPersistentAgentConfigToRoom(read: IRead, rid: string) {
    try {
        const assoc = getRoomAssoc(rid);
        const persistentData = await retrieveDataByAssociation(read, assoc);
        const { roomAgentConfigs } = persistentData;

        if (roomAgentConfigs) {
            return roomAgentConfigs[rid] || false;
        }
        return false;
    } catch (e) {
        throw new Error(e);
    }
}

export const getIsProcessingMessage = async (read: IRead,  rid: string) => {
    const {isProcessingMessage} = await retrieveDataByAssociation(read, getProcessingAssoc(rid));
    return isProcessingMessage;
};

export const setIsProcessingMessage = async (persistence: IPersistence,  rid: string, isProcessingMessage: boolean) => {
    await persistence.updateByAssociation(getProcessingAssoc(rid), { isProcessingMessage }, true);
};
