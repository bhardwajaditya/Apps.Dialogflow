import { Base64 } from '../enum/Dialogflow';

export const getError = (error: any) => {
    if (typeof error === 'object') {
        const errorObject = Object.getOwnPropertyNames(error).reduce((acc, key) => { acc[key] = error[key]; return acc; }, {});
        return JSON.stringify(errorObject);
    }
    return error;
};

export const base64urlEncode = (str: any) => {
    const utf8str = unescape(encodeURIComponent(str));
    return base64EncodeData(utf8str, utf8str.length, Base64.BASE64_DICTIONARY, Base64.BASE64_PAD);
};

export const base64EncodeData = (data: string, len: number, b64x: string, b64pad: string) => {
    let dst = '';
    let i: number;

    // tslint:disable:no-bitwise
    for (i = 0; i <= len - 3; i += 3) {

        dst += b64x.charAt(data.charCodeAt(i) >>> 2);
        dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4) | (data.charCodeAt(i + 1) >>> 4));
        dst += b64x.charAt(((data.charCodeAt(i + 1) & 15) << 2) | (data.charCodeAt(i + 2) >>> 6));
        dst += b64x.charAt(data.charCodeAt(i + 2) & 63);

    }

    if (len % 3 === 2) {
        dst += b64x.charAt(data.charCodeAt(i) >>> 2);
        dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4) | (data.charCodeAt(i + 1) >>> 4));
        dst += b64x.charAt(((data.charCodeAt(i + 1) & 15) << 2));
        dst += b64pad;
    } else if (len % 3 === 1) {
        dst += b64x.charAt(data.charCodeAt(i) >>> 2);
        dst += b64x.charAt(((data.charCodeAt(i) & 3) << 4));
        dst += b64pad;
        dst += b64pad;
    }
    // tslint:enable:no-bitwise

    return dst;
};

export const uuid = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
