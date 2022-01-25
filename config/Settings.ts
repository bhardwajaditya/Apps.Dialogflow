import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export enum AppSetting {
    DialogflowBotList = 'agents',
    DialogflowAgentProjectId = 'project_id',
    DialogflowAgentId = 'agent_id',
    DialogflowAgentClientEmail = 'client_email',
    DialogflowAgentRegion = 'agent_region',
    DialogflowAgentDefaultLanguage = 'agent_default_language',
    DialogflowAgentVersion = 'agent_version',
    DialogflowAgentEnvironmentId = 'environment_id',
    DialogflowAgentPrivateKey = 'private_key',
    DialogflowFallbackResponsesLimit = 'fallback_responses_limit',
    FallbackTargetDepartment = 'fallback_target_department',
    DialogflowHandoverMessage = 'handover_message',
    DialogflowServiceUnavailableMessage = 'service_unavailable_message',
    DialogflowHandoverFailedMessage = 'no_agents_for_handover_message',
    DialogflowCloseChatMessage = 'close_chat_message',
    DialogflowHideQuickReplies = 'hide_quickreplies',
    DialogflowEnableChatClosedByVisitorEvent = 'enable_chat_closed_by_visitor_event',
    DialogflowEnableWelcomeMessage = 'enable_welcome_message',
    DialogflowWelcomeMessage = 'welcome_message',
    DialogflowChatClosedByVisitorEventName = 'chat_closed_by_visitor_event',
    DialogflowWelcomeIntentOnStart = 'welcome_intent_on_start',
    DialogflowEnableCustomerTimeout = 'enable_customer_timeout',
    DialogflowCustomerTimeoutTime = 'customer_timeout_time',
    DialogflowCustomerTimeoutWarningTime = 'customer_timeout_warning_time',
    DialogflowCustomerTimeoutWarningMessage = 'customer_timeout_warning_message',
    DialogflowSessionMaintenanceInterval = 'session_maintenance_interval',
    DialogflowSessionMaintenanceEventName = 'session_maintenance_event_name',
    DialogflowLogLevel = 'log_level',
    DialogflowCXFallbackEvents = 'dialogflow_cx_fallback_events',
    DialogflowDisableComposerOnTriggerEvent = 'dialogflow_disable_composer_on_trigger_event',
    DialogflowFileAttachmentEventName = 'dialogflow_file_attachment_event_name',
}

export enum ServerSetting {
    SITE_URL = 'Site_Url',
}

export enum DefaultMessage {
    DEFAULT_DialogflowRequestFailedMessage = 'Sorry, I\'m having trouble with that.',
    DEFAULT_DialogflowHandoverFailedMessage = 'Sorry I\'m unable to transfer you to an agent.',
    DEFAULT_DialogflowWelcomeMessage = 'Hi there! I am a virtual assistant, designed to answer questions about your service.',
    DEFAULT_DialogflowServiceUnavailableMessage = 'There are no agents currently available. Our Customer Care team is available by phone 24/7 at 1-855-463-9333.',
    DEFAULT_DialogflowCloseChatMessage = 'Thanks for contacting Viasat Customer Care. We appreciate your business. Please close this window to end your chat session.',
    DEFAULT_DialogflowHandoverMessage = 'Connecting you with a live agent',
    DEFAULT_DialogflowCustomerTimeoutWarningMessage = 'Are you still there? Please send a message within %t or this chat will time out.',
}

const agentConfigTemplate = JSON.stringify(
    [{
        omnichannel_agent: {
            project_id: '',
            client_email: '',
            agent_id: '',
            agent_region: '',
            agent_default_language: 'EN',
            environment_id: '',
            private_key: '',
            agent_version: '',
            fallback_responses_limit: 3,
            fallback_target_department: 'Viasat Customer Support',
            handover_message: 'Connecting you with a live agent',
            no_agents_for_handover_message: '',
            // tslint:disable-next-line: max-line-length
            service_unavailable_message: 'There are no agents currently available. Our Customer Care team is available by phone 24/7 at 1-855-463-9333.',
            close_chat_message: 'Thanks for contacting Viasat Customer Care. We appreciate your business. Please close this window to end your chat session.',
            hide_quickreplies: true,
            enable_chat_closed_by_visitor_event: true,
            chat_closed_by_visitor_event: 'end_live_chat',
            enable_welcome_message: true,
            welcome_message: 'Hi there! I am a virtual assistant, designed to answer questions about your service.',
            welcome_intent_on_start: true,
            enable_customer_timeout: false,
            customer_timeout_time: 240,
            customer_timeout_warning_time: 180,
            customer_timeout_warning_message: 'Are you still there? Please send a message within %t or this chat will time out.',
            session_maintenance_interval: '5 minutes',
            session_maintenance_event_name: 'session_maintenance',
            dialogflow_disable_composer_on_trigger_event: false,
        },
    }], null, '\t');

export const settings: Array<ISetting> = [

    {
        id: AppSetting.DialogflowBotList,
        public: true,
        type: SettingType.MULTICODE,
        packageValue: agentConfigTemplate,
        i18nLabel: 'dialogflow_bot_list_config',
        i18nDescription: 'dialogflow_bot_list_config_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowLogLevel,
        public: true,
        type: SettingType.SELECT,
        packageValue: '0',
        value: '0',
        values: [
            {
                key: '0',
                i18nLabel: '0_Errors_Only',
            }, {
                key: '1',
                i18nLabel: '1_Errors_and_Information',
            }, {
                key: '2',
                i18nLabel: '2_Erros_Information_and_Debug',
            },
        ],
        i18nLabel: 'dialogflow_log_level',
        i18nDescription: 'dialogflow_log_level_description',
        required: false,
    },
];
