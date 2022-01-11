import { IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { getLivechatAgentConfig } from './Settings';

export const getRoomAssoc = (rid: string) => new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `DF-RID-${rid}`);

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
        const persistentData = await retrieveDataByAssociation(read, assoc);
        let { roomAgentData } = persistentData;
        if ( !roomAgentData ) {
            roomAgentData = { roomAgentConfigs: {} };
            roomAgentData.roomAgentConfigs[rid] = agentConfig;
            persistence.createWithAssociation(roomAgentData, assoc);
        } else {
            roomAgentData.roomAgentConfigs[rid] = agentConfig;
            const updatedData = {
                ... persistentData,
                roomAgentData,
            };
            await persistence.updateByAssociation(assoc, updatedData, true);
        }
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
