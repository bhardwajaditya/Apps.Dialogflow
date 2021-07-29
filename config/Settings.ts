import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
export enum AppSetting {
    DialogflowBotUsername = 'dialogflow_bot_username',
    DialogflowBotId = 'dialogflow_bot_id',
    DialogflowProjectId = 'dialogflow_project_id',
    DialogflowVersion = 'dialog_flow_version',
    DialogflowClientEmail = 'dialogflow_client_email',
    DialogFlowPrivateKey = 'dialogflow_private_key',
    DialogflowEnvironment = 'dialogflow_environment',
    DialogflowDefaultLanguage = 'dialogflow_default_language',
    DialogflowFallbackResponsesLimit = 'dialogflow_fallback_responses_limit',
    FallbackTargetDepartment = 'fallback_target_department',
    DialogflowHandoverMessage = 'dialogflow_handover_message',
    DialogflowServiceUnavailableMessage = 'dialogflow_service_unavailable_message',
    DialogflowCloseChatMessage = 'dialogflow_close_chat_message',
    DialogflowHideQuickReplies = 'dialogflow_hide_quick_replies',
    DialogflowEnableChatClosedByVisitorEvent = 'dialogflow_enable_chat_closed_by_visitor_event',
    DialogflowEnableWelcomeMessage = 'dialogflow_enable_welcome_message',
    DialogflowWelcomeMessage = 'dialogflow_welcome_message',
    DialogflowChatClosedByVisitorEventName = 'dialogflow_chat_closed_by_visitor_event_name',
    DialogflowWelcomeIntentOnStart = 'dialogflow_welcome_intent_on_start',
    DialogflowEnableCustomerTimeout = 'dialogflow_enable_customer_timeout',
    DialogflowCustomerTimeoutTime = 'dialogflow_customer_timeout_time',
    DialogflowCustomerTimeoutWarningTime = 'dialogflow_customer_timeout_warning_time',
    DialogflowCustomerTimeoutWarningMessage = 'dialogflow_customer_timeout_warning_message',
    DialogflowSessionMaintenanceInterval = 'dialogflow_session_maintenance_interval',
    DialogflowSessionMaintenanceEventName = 'dialogflow_session_maintenance_event_name',
    DialogflowLogLevel = 'log_level',
    DialogflowAgentId = 'dialogflow_cx_agent_id',
    DialogflowRegion = 'dialogflow_cx_region',
    DialogflowCXFallbackEvents = 'dialogflow_cx_fallback_events',
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

export const settings: Array<ISetting> = [
    {
        id: AppSetting.DialogflowVersion,
        public: true,
        type: SettingType.SELECT,
        packageValue: 'ES',
        i18nLabel: 'agent_version',
        values: [
            { key: 'ES', i18nLabel: 'ES' },
            { key: 'CX', i18nLabel: 'CX' },
        ],
        required: true,
    },
    {
        id: AppSetting.DialogflowBotUsername,
        public: true,
        type: SettingType.STRING,
        packageValue: 'virtualassistant',
        i18nLabel: 'bot_username',
        required: true,
    },
    {
        id: AppSetting.DialogflowBotId,
        public: true,
        type: SettingType.NUMBER,
        packageValue: 1,
        value: 1,
        i18nLabel: 'dialogflow_bot_id',
        i18nDescription: 'dialogflow_bot_id_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowProjectId,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'dialogflow_project_id',
        required: true,
    },
    {
        id: AppSetting.DialogflowClientEmail,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'dialogflow_client_email',
        required: true,
    },
    {
        id: AppSetting.DialogFlowPrivateKey,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'dialogflow_private_key',
        required: true,
    },
    {
        id: AppSetting.DialogflowEnvironment,
        public: true,
        type: SettingType.STRING,
        packageValue: 'draft',
        i18nLabel: 'dialogflow_environment',
        i18nDescription: 'dialogflow_environment_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowAgentId,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'dialogflow_cx_agent_id',
        i18nDescription: 'dialogflow_cx_agent_id_desc',
        required: false,
    },
    {
        id: AppSetting.DialogflowRegion,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'dialogflow_cx_region',
        i18nDescription: 'dialogflow_cx_region_desc',
        required: false,
    },
    {
        id: AppSetting.DialogflowDefaultLanguage,
        public: true,
        type: SettingType.SELECT,
        packageValue: 'en',
        i18nLabel: 'agent_version',
        values: [
            { key: 'en', i18nLabel: 'English' },
            { key: 'pt-BR', i18nLabel: 'Portuguese - Brazil' },
        ],
        required: true,
    },
    {
        id: AppSetting.DialogflowFallbackResponsesLimit,
        public: true,
        type: SettingType.NUMBER,
        packageValue: 3,
        value: 3,
        i18nLabel: 'dialogflow_fallback_responses_limit',
        i18nDescription: 'dialogflow_fallback_responses_limit_description',
        required: false,
    },
    {
        id: AppSetting.FallbackTargetDepartment,
        public: true,
        type: SettingType.STRING,
        packageValue: 'Viasat Customer Support',
        i18nLabel: 'target_department_for_handover',
        i18nDescription: 'target_department_for_handover_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowHandoverMessage,
        public: true,
        type: SettingType.STRING,
        packageValue: DefaultMessage.DEFAULT_DialogflowHandoverMessage,
        i18nLabel: 'dialogflow_handover_message',
        i18nDescription: 'dialogflow_handover_message_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowServiceUnavailableMessage,
        public: true,
        type: SettingType.STRING,
        packageValue: DefaultMessage.DEFAULT_DialogflowServiceUnavailableMessage,
        i18nLabel: 'dialogflow_service_unavailable_message',
        i18nDescription: 'dialogflow_service_unavailable_message_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowCloseChatMessage,
        public: true,
        type: SettingType.STRING,
        packageValue: DefaultMessage.DEFAULT_DialogflowCloseChatMessage,
        i18nLabel: 'dialogflow_close_chat_message',
        i18nDescription: 'dialogflow_close_chat_message_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowHideQuickReplies,
        public: true,
        type: SettingType.BOOLEAN,
        packageValue: true,
        value: true,
        i18nLabel: 'dialogflow_hide_quick_replies',
        i18nDescription: 'dialogflow_hide_quick_replies_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowEnableChatClosedByVisitorEvent,
        public: true,
        type: SettingType.BOOLEAN,
        packageValue: true,
        value: true,
        i18nLabel: 'dialogflow_enable_chat_closed_by_visitor_event',
        i18nDescription: 'dialogflow_enable_chat_closed_by_visitor_event_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowChatClosedByVisitorEventName,
        public: true,
        type: SettingType.STRING,
        packageValue: 'end_live_chat',
        i18nLabel: 'dialogflow_chat_closed_by_visitor_event_name',
        i18nDescription: 'dialogflow_chat_closed_by_visitor_event_name_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowEnableWelcomeMessage,
        public: true,
        type: SettingType.BOOLEAN,
        packageValue: true,
        i18nLabel: 'dialogflow_enable_welcome_message',
        i18nDescription: 'dialogflow_enable_welcome_message_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowWelcomeMessage,
        public: true,
        type: SettingType.STRING,
        packageValue: DefaultMessage.DEFAULT_DialogflowWelcomeMessage,
        i18nLabel: 'dialogflow_welcome_message',
        i18nDescription: 'dialogflow_welcome_message_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowWelcomeIntentOnStart,
        public: true,
        type: SettingType.BOOLEAN,
        packageValue: true,
        i18nLabel: 'dialogflow_welcome_intent_on_start',
        i18nDescription: 'dialogflow_welcome_intent_on_start_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowEnableCustomerTimeout,
        public: true,
        type: SettingType.BOOLEAN,
        packageValue: false,
        i18nLabel: 'dialogflow_enable_customer_timeout',
        i18nDescription: 'dialogflow_enable_customer_timeout_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowCustomerTimeoutTime,
        public: true,
        type: SettingType.NUMBER,
        packageValue: 240,
        i18nLabel: 'dialogflow_customer_timeout_time',
        i18nDescription: 'dialogflow_customer_timeout_time_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowCustomerTimeoutWarningTime,
        public: true,
        type: SettingType.NUMBER,
        packageValue: 180,
        i18nLabel: 'dialogflow_customer_timeout_warning_time',
        i18nDescription: 'dialogflow_customer_timeout_warning_time_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowCustomerTimeoutWarningMessage,
        public: true,
        type: SettingType.STRING,
        packageValue: DefaultMessage.DEFAULT_DialogflowCustomerTimeoutWarningMessage,
        i18nLabel: 'dialogflow_customer_timeout_warning_message',
        i18nDescription: 'dialogflow_customer_timeout_warning_message_description',
        required: true,
    },
    {
        id: AppSetting.DialogflowSessionMaintenanceInterval,
        public: true,
        type: SettingType.STRING,
        packageValue: '5 minutes',
        i18nLabel: 'dialogflow_session_maintenance_interval',
        i18nDescription: 'dialogflow_session_maintenance_interval_description',
        required: false,
    },
    {
        id: AppSetting.DialogflowSessionMaintenanceEventName,
        public: true,
        type: SettingType.STRING,
        packageValue: 'session_maintenance',
        i18nLabel: 'dialogflow_session_maintenance_event_name',
        i18nDescription: 'dialogflow_session_maintenance_event_name_description',
        required: false,
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
