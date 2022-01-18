import { HttpStatusCode } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiResponse } from '@rocket.chat/apps-engine/definition/api';

export const createHttpRequest = (headers, data) => {
    return {
        headers: {
            ...headers,
        },
        data: {
            ...data,
        },
        timeout: 35 * 1000,
    };
};

export const createHttpResponse = (status: HttpStatusCode, headers: object, payload: object): IApiResponse => {
    return {
        status,
        headers: {
            ...headers,
        },
        content: {
            ...payload,
        },
    };
};
