function safeText(value) {
    return String(value).replace(/[`*_\\[\]()~>#+\-=|{}.!]/g, "");
}

module.exports = { safeText };