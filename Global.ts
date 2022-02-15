import { IApp } from '@rocket.chat/apps-engine/definition/IApp';

export class Global {
    /*
    * TODO: We are only using app for logger(Which shows up in Admin -> App Info -> Logs).
    * It is being used in many core function of this app i.e, createMessage. Which makes these functions not usable where the app object is not available
    * This Globle App object can be used in these functions for now. And also it's not a good idea to Global whole App object.
    * So in future we will make only necessary object Global. i.e. Logger
    * The idea is to remove dependecy of this App object from every core functions. and use Global logger instead.
    * This is big refactor and will be done as separate task
    */
    public static app: IApp;
}
