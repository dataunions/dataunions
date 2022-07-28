// import { DataUnionClient } from "@dataunions/client";

export class JoinServer {
    constructor({ privateKey, port, logLevel, customJoinRequestValidator, customRoutes, onMemberJoin, expressApp, httpServer, logger, dataUnionClient, signedRequestValidator, joinRequestService, }?: {
        privateKey: any;
        port?: number;
        logLevel?: string;
        customJoinRequestValidator?: (address: string, joinRequest: JoinRequest) => Promise<void>;
        customRoutes?: () => void;
        onMemberJoin?: () => Promise<void>;
        expressApp?: import("express-serve-static-core").Express;
        httpServer?: any;
        logger?: any;
        dataUnionClient?: any; //DataUnionClient;
        signedRequestValidator?: (req: any) => Promise<void>;
        joinRequestService?: service.JoinRequestService;
    });
    expressApp: import("express-serve-static-core").Express;
    logger: any;
    dataUnionClient: any;
    signedRequestValidator: (req: any) => Promise<void>;
    customJoinRequestValidator: () => Promise<void>;
    joinRequestService: service.JoinRequestService;
    customRoutes: () => void;
    httpServer: any;
    port: number;
    routes(): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    sendJsonResponse(res: any, status: any, response: any): void;
    sendJsonError(res: any, status: any, message: any): void;
    joinRequest(req: any, res: any, _next: any): Promise<void>;
}
export class JoinRequest {
    chain: string;
    dataUnion: string;
    [key: string]: unknown;
}
import service = require("../service");
