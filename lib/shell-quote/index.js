// Minimal shell-quote stub for react-devtools-core compatibility.
// Only quote() and parse() are needed; devtools uses them for process spawning
// in a Node.js context that never runs inside Expo/React Native.

function quote(xs) {
  return xs.map(function (s) {
    if (s && typeof s === 'object') {
      return s.op.replace(/(.)/g, '\\$1');
    }
    if (/["\s\\$`!#&*;|(){}<>\[\]~?]/.test(s) || s.length === 0) {
      return (
        '"' +
        s.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/\\/g, '\\\\') +
        '"'
      );
    }
    return String(s).replace(/([A-Za-z]:)?(.)/g, function (_, drive, c) {
      return drive ? drive + c : c;
    });
  }).join(' ');
}

function parse(s, env, opts) {
  var chunker = /(['"])((?:\\.|(?!\1)[^\\])*)\1|(?:\\.|[^\s'"])+|[\s]+/g;
  var match = s.match(chunker);
  if (!match) return [];
  var commented = false;
  return match.reduce(function (tokens, tok) {
    if (commented) return tokens;
    if (/^#/.test(tok)) {
      commented = true;
      return tokens;
    }
    var quote = tok.charAt(0);
    if (quote === "'" || quote === '"') {
      tok = tok.slice(1, -1);
      if (quote === "'") tok = tok.replace(/\\(.)/g, '$1');
    }
    if (typeof env === 'object') {
      tok = tok.replace(/\$(\w+)|\$\{(\w+)\}/g, function (_, a, b) {
        return env[a || b] !== undefined ? env[a || b] : '$' + (a || b);
      });
    }
    tokens.push(tok);
    return tokens;
  }, []);
}

module.exports = { quote: quote, parse: parse };
