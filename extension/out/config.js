"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const vscode = __importStar(require("vscode"));
function cleanBase(u) { return u.replace(/\/+$/, ""); }
function cleanPath(p) { return p.startsWith("/") ? p : `/${p}`; }
exports.config = {
    get endpoint() {
        const base = vscode.workspace.getConfiguration("raas")
            .get("serverUrl", "http://localhost:8000");
        return cleanBase(base);
    },
    get chatPath() {
        return vscode.workspace.getConfiguration("raas")
            .get("chatPath", "/api/v1/chat/form");
    },
    get completionPath() {
        return vscode.workspace.getConfiguration("raas")
            .get("completionPath", "/api/v1/code-completion");
    },
    get timeout() {
        return vscode.workspace.getConfiguration("raas")
            .get("timeout", 100000);
    },
    get debounceMs() {
        return vscode.workspace.getConfiguration("raas")
            .get("debounceMs", 300);
    },
    /** Returns a full URL for either a relative path or an absolute override */
    toUrl(pathOrUrl) {
        if (/^https?:\/\//i.test(pathOrUrl))
            return pathOrUrl; // absolute override
        return this.endpoint + cleanPath(pathOrUrl); // join to base
    }
};
//# sourceMappingURL=config.js.map