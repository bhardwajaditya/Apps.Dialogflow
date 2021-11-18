import { IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

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

export const getIsProcessingMessage = async (read: IRead,  rid: string) => {
    const {isProcessingMessage} = await retrieveDataByAssociation(read, getProcessingAssoc(rid));
    return isProcessingMessage;
};

export const setIsProcessingMessage = async (persistence: IPersistence,  rid: string, isProcessingMessage: boolean) => {
    await persistence.updateByAssociation(getProcessingAssoc(rid), { isProcessingMessage }, true);
};
