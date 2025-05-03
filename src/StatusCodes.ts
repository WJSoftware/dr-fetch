/**
 * Enumerates all standardized HTTP status codes, except for the ones in the 1xx and 3xx ranges.
 * 
 * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
 */
export const StatusCodes = Object.freeze({
    /**
     * The request has succeeded.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/200)
     */
    Ok: 200,
    /**
     * The request has been fulfilled and resulted in a new resource being created.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201)
     */
    Created: 201,
    /**
     * The server has accepted the request but has not yet processed it.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202)
    */
    Accepted: 202,
    /**
     * This response code means the returned metadata is not exactly the same as is available from the origin server, 
     * but is collected from a local or a third-party copy. This is mostly used for mirrors or backups of another 
     * resource.  Except for that specific case, the 200 OK response is preferred to this status.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/203)
     */
    NonAuthoritativeInformation: 203,
    /**
     * The server successfully processed the request, but is not returning any content.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204)
     */
    NoContent: 204,
    /**
     * The server successfully processed the request, and is not returning any content, but requires that the requester 
     * reset the document view.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/205)
     */
    ResetContent: 205,
    /**
     * The server is delivering only part of the resource due to a range header sent by the client.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206)
     */
    PartialContent: 206,
    /**
     * The message body that follows is an XML message and can contain a number of separate response codes, depending on 
     * how many sub-requests were made.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/207)
     */
    MultiStatus: 207,
    /**
     * Used inside a `<dav:propstat>` response element to avoid repeatedly enumerating the internal members of multiple 
     * bindings to the same collection.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/208)
     */
    AlreadyReported: 208,
    /**
     * The server has fulfilled a GET request for the resource, and the response is a representation of the result of 
     * one or more instance-manipulations applied to the current instance.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/226)
     */
    IMUsed: 226,
    /**
     * The server cannot or will not process the request due to something that is perceived to be a client error 
     * (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400)
     */
    BadRequest: 400,
    /**
     * The client must authenticate itself to get the requested response.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401)
     */
    Unauthorized: 401,
    /**
     * Payment is required to access the requested resource.
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402)
     */
    PaymentRequired: 402,
    /**
     * The client does not have access rights to the content.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403)
     */
    Forbidden: 403,
    /**
     * The server can not find the requested resource.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404)
     */
    NotFound: 404,
    /**
     * The request method is known by the server but has been disabled and cannot be used.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405)
     */
    MethodNotAllowed: 405,
    /**
     * This response is sent when the web server, after performing server-driven content negotiation, doesn't find any 
     * content that conforms to the criteria given by the user agent.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/406)
     */
    NotAcceptable: 406,
    /**
     * This is similar to 401 but authentication is needed to be done by a proxy.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/407)
     */
    ProxyAuthenticationRequired: 407,
    /**
     * This response is sent on an idle connection by some servers, even without any previous request by the client.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408)
     */
    RequestTimeout: 408,
    /**
     * The request conflicts with the current state of the server.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409)
     */
    Conflict: 409,
    /**
     * This response would be sent when the requested content has been permanently deleted from server, with no 
     * forwarding address.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410)
     */
    Gone: 410,
    /**
     * The server rejected the request because the Content-Length header field is not defined and the server requires it.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/411)
     */
    LengthRequired: 411,
    /**
     * The client has indicated preconditions in its headers which the server does not meet.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412)
     */
    PreconditionFailed: 412,
    /**
     * The request is larger than the server is willing or able to process.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413)
     */
    PayloadTooLarge: 413,
    /**
     * The URI requested by the client is longer than the server is willing to interpret.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/414)
     */
    URITooLong: 414,
    /**
     * The media format of the requested data is not supported by the server.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/415)
     */
    UnsupportedMediaType: 415,
    /**
     * The range specified by the Range header field in the request can't be fulfilled.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416)
     */
    RangeNotSatisfiable: 416,
    /**
     * This response code means the expectation indicated by the Expect request header field can't be met by the server.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/417)
     */
    ExpectationFailed: 417,
    /**
     * The server refuses the attempt to brew coffee with a teapot.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418)
     */
    ImATeapot: 418,
    /**
     * The request was directed at a server that is not able to produce a response.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/421)
     */
    MisdirectedRequest: 421,
    /**
     * The request was well-formed but was unable to be followed due to semantic errors.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422)
     */
    UnprocessableEntity: 422,
    /**
     * The resource that is being accessed is locked.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/423)
     */
    Locked: 423,
    /**
     * The request failed due to failure of a previous request.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/424)
     */
    FailedDependency: 424,
    /**
     * Indicates that the server is unwilling to risk processing a request that might be replayed.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/425)
     */
    TooEarly: 425,
    /**
     * The server refuses to perform the request using the current protocol but might be willing to do so after the 
     * client upgrades to a different protocol.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/426)
     */
    UpgradeRequired: 426,
    /**
     * The origin server requires the request to be conditional.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/428)
     */
    PreconditionRequired: 428,
    /**
     * The user has sent too many requests in a given amount of time ("rate limiting").
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
     */
    TooManyRequests: 429,
    /**
     * The server is unwilling to process the request because its header fields are too large.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/431)
     */
    RequestHeaderFieldsTooLarge: 431,
    /**
     * The user-agent requested a resource that cannot legally be provided, such as a web page censored by a government.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/451)
     */
    UnavailableForLegalReasons: 451,
    /**
     * The server has encountered a situation it doesn't know how to handle.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500)
     */
    InternalServerError: 500,
    /**
     * The request method is not supported by the server and cannot be handled.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501)
     */
    NotImplemented: 501,
    /**
     * The server is acting as a gateway or proxy and received an invalid response from the upstream server.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502)
     */
    BadGateway: 502,
    /**
     * The server is not ready to handle the request.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503)
     */
    ServiceUnavailable: 503,
    /**
     * This error response is given when the server is acting as a gateway and cannot get a response in time.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504)
     */
    GatewayTimeout: 504,
    /**
     * The HTTP version used in the request is not supported by the server.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/505)
     */
    HTTPVersionNotSupported: 505,
    /**
     * The server has an internal configuration error: the chosen variant resource is configured to engage in 
     * transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/506)
     */
    VariantAlsoNegotiates: 506,
    /**
     * The server is unable to store the representation needed to complete the request.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/507)
     */
    InsufficientStorage: 507,
    /**
     * The server detected an infinite loop while processing the request.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/508)
     */
    LoopDetected: 508,
    /**
     * Further extensions to the request are required for the server to fulfill it.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/510)
     */
    NotExtended: 510,
    /**
     * The client needs to authenticate to gain network access.
     * 
     * [Online Documentation at MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/511)
     */
    NetworkAuthenticationRequired: 511,
});
