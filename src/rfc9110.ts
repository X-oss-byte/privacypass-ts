// Consumes data:
//   PrivateToken challenge="abc...", token-key="123...",
//   PrivateToken challenge="def...", token-key="234...",
//   PrivateToken challenge=ghi..., token-key=345...
// Parse WWW-Authenticate according to RFC9110 Section 11.6.1 https://www.rfc-editor.org/rfc/rfc9110#section-11.6.1
function parseWWWAuthenticateInternal(header: string, includeNonCompliantToken: boolean): string[] {
    const ALPHA = 'A-Za-z';
    const DIGIT = '0-9';
    let tokenChar = `!#$%&'*+\\-\\.^_\`|~${DIGIT}${ALPHA}`;
    const nonRFCCompliantTokenCharFoundInTheWild = '=';
    if (includeNonCompliantToken) {
        tokenChar += nonRFCCompliantTokenCharFoundInTheWild;
    }
    const tchar = `[${tokenChar}]`;
    const OWS = '[ \\t]*';
    const BWS = OWS;
    const qdtext = '[ \\t\\x21\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]';
    const quotedPair = '\\\\[ \\t\\x21-\\x7E\\x80-\\xFF]';
    const quotedString = `"(?:${qdtext}|${quotedPair})*"`;
    const token = tchar + '+';
    const authParam = `${token}${BWS}=${BWS}(?:${token}|${quotedString})`;
    const authScheme = token;
    // const token68 = `[\\/+\\-\\._~${DIGIT}${ALPHA}]+=*`;
    // while RFC 9110 allows for token68 as an alternative to authparam, Privacy Pass does not have any such parameters, and I've not yet seen in it any deployment
    // I could not make the regex work with "token68 | authParam", and am fine with not supporting this usecase for now
    const challenge = `${authScheme}(?: +(?:${authParam}(?:${OWS},${OWS}${authParam})*))?`;
    const challenges = `(?<skip>${OWS},${OWS})?(?<challenge>${challenge})`;

    // The below eslint warning comes from the fact the function can or cannot include non compliant characters based on input parameters
    // This means the regex is not built statically
    // This is an ok behaviour in this case, given the dynamic component is scoped
    // eslint-disable-next-line security/detect-non-literal-regexp
    const challengesRegex = new RegExp(`${challenges}`, 'y');

    let first = true;
    let everythingConsumed = false;
    const matches: string[] = [];
    for (let m; (m = challengesRegex.exec(header)); ) {
        if (first) {
            if (m?.groups?.skip) {
                break;
            }
            first = false;
        }
        const data = m?.groups?.challenge;
        if (data) {
            matches.push(data);
        }
        everythingConsumed = header.length === challengesRegex.lastIndex;
    }
    if (!everythingConsumed) {
        return [];
    }

    return matches;
}

// Consumes data:
//   PrivateToken challenge="abc...", token-key="123...",
//   PrivateToken challenge="def...==", token-key="234...",
//   PrivateToken challenge=ghi..., token-key=345...
// Parse WWW-Authenticate according to RFC9110 Section 11.6.1 https://www.rfc-editor.org/rfc/rfc9110#section-11.6.1
export function parseWWWAuthenticate(header: string): string[] {
    return parseWWWAuthenticateInternal(header, false);
}

// This method devites from the RFC9110 specification, and allows for non compliant tokens to be parsed
// These tokens have been observed in the wild, and are required for Privacy Pass to be backward compatible with these deviations
// Consumes data:
//   PrivateToken challenge="abc...", token-key="123...",
//   PrivateToken challenge="def...==", token-key="234...",
//   PrivateToken challenge=ghi...==, token-key=345...
// Parse WWW-Authenticate according to RFC9110 Section 11.6.1 https://www.rfc-editor.org/rfc/rfc9110#section-11.6.1
export function parseWWWAuthenticateWithNonCompliantTokens(header: string): string[] {
    return parseWWWAuthenticateInternal(header, true);
}

function authParamToString(
    param: string,
    value: string | number | null,
    quotedString: boolean,
): string {
    // WWW-Authenticate does not impose authentication parameters escape with a double quote
    // For more details, refer to RFC9110 Section 11.2 https://www.rfc-editor.org/rfc/rfc9110#section-11.2
    const quote = quotedString ? '"' : '';
    if (value === null) {
        return param;
    }
    return `${param}=${quote}${value}${quote}`;
}

export function toStringWWWAuthenticate(
    authScheme: string,
    authParams?: Record<string, string | number | null>,
    quotedString = false,
): string {
    if (authParams === undefined) {
        return authScheme;
    }
    const params = Object.entries(authParams)
        .map(([param, value]) => authParamToString(param, value, quotedString))
        .join(',');
    return `${authScheme} ${params}`;
}
