
export interface ComponentStatus {
    reqId: string;
    reqCompId: string;
    reqestedComp: string;
    compExecutionStatus: string;
    executionErrorMsg: string;
    executionStage: string;
    exeDtTime: string; // ISO date string
    registrationStatus: string;
    registerUrl: string;
    isPublishApi: string;
}