export class JoinRequestService {
    constructor(logger: any, dataUnionClient: any, onMemberJoin: any);
    logger: any;
    dataUnionClient: any;
    onMemberJoin: any;
    create(member: any, dataUnion: any, chain: any): Promise<{
        member: any;
        dataUnion: any;
        chain: any;
    }>;
}
export class DataUnionRetrievalError extends Error {
}
export class DataUnionJoinError extends Error {
}
