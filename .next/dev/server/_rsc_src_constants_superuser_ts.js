"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_rsc_src_constants_superuser_ts";
exports.ids = ["_rsc_src_constants_superuser_ts"];
exports.modules = {

/***/ "(rsc)/./src/constants/superuser.ts":
/*!************************************!*\
  !*** ./src/constants/superuser.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   SUPERUSER_EMAILS: () => (/* binding */ SUPERUSER_EMAILS),\n/* harmony export */   isSuperuserEmail: () => (/* binding */ isSuperuserEmail)\n/* harmony export */ });\n// src/constants/superuser.ts\n// Liste der Superuser (E-Mails)\nconst SUPERUSER_EMAILS = [\n    'admin@example.com',\n    'michael@mysight.net'\n];\nconst isSuperuserEmail = (email)=>{\n    if (!email) return false;\n    const lowerEmail = email.toLowerCase().trim();\n    // 1. Prüfe Hardcoded Liste\n    if (SUPERUSER_EMAILS.map((e)=>e.toLowerCase()).includes(lowerEmail)) {\n        return true;\n    }\n    // 2. Prüfe Environment Variable (optional)\n    const envEmails = process.env.NEXT_PUBLIC_SUPERUSER_EMAILS?.split(',') || [];\n    return envEmails.map((e)=>e.toLowerCase().trim()).includes(lowerEmail);\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvY29uc3RhbnRzL3N1cGVydXNlci50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBLDZCQUE2QjtBQUU3QixnQ0FBZ0M7QUFDekIsTUFBTUEsbUJBQW1CO0lBQzVCO0lBQ0E7Q0FDSCxDQUFDO0FBRUssTUFBTUMsbUJBQW1CLENBQUNDO0lBQzdCLElBQUksQ0FBQ0EsT0FBTyxPQUFPO0lBQ25CLE1BQU1DLGFBQWFELE1BQU1FLFdBQVcsR0FBR0MsSUFBSTtJQUUzQywyQkFBMkI7SUFDM0IsSUFBSUwsaUJBQWlCTSxHQUFHLENBQUNDLENBQUFBLElBQUtBLEVBQUVILFdBQVcsSUFBSUksUUFBUSxDQUFDTCxhQUFhO1FBQ2pFLE9BQU87SUFDWDtJQUVBLDJDQUEyQztJQUMzQyxNQUFNTSxZQUFZQyxRQUFRQyxHQUFHLENBQUNDLDRCQUE0QixFQUFFQyxNQUFNLFFBQVEsRUFBRTtJQUM1RSxPQUFPSixVQUFVSCxHQUFHLENBQUNDLENBQUFBLElBQUtBLEVBQUVILFdBQVcsR0FBR0MsSUFBSSxJQUFJRyxRQUFRLENBQUNMO0FBQy9ELEVBQUUiLCJzb3VyY2VzIjpbIi9Vc2Vycy9taWNoYWVsL0RvY3VtZW50cy9teXNpZ2h0IHBtby9wcm9qZWt0Ym9hcmQgcGxhdGZvcm0vc3JjL2NvbnN0YW50cy9zdXBlcnVzZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gc3JjL2NvbnN0YW50cy9zdXBlcnVzZXIudHNcblxuLy8gTGlzdGUgZGVyIFN1cGVydXNlciAoRS1NYWlscylcbmV4cG9ydCBjb25zdCBTVVBFUlVTRVJfRU1BSUxTID0gW1xuICAgICdhZG1pbkBleGFtcGxlLmNvbScsIFxuICAgICdtaWNoYWVsQG15c2lnaHQubmV0JyBcbl07XG5cbmV4cG9ydCBjb25zdCBpc1N1cGVydXNlckVtYWlsID0gKGVtYWlsOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogYm9vbGVhbiA9PiB7XG4gICAgaWYgKCFlbWFpbCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGxvd2VyRW1haWwgPSBlbWFpbC50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICBcbiAgICAvLyAxLiBQcsO8ZmUgSGFyZGNvZGVkIExpc3RlXG4gICAgaWYgKFNVUEVSVVNFUl9FTUFJTFMubWFwKGUgPT4gZS50b0xvd2VyQ2FzZSgpKS5pbmNsdWRlcyhsb3dlckVtYWlsKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgLy8gMi4gUHLDvGZlIEVudmlyb25tZW50IFZhcmlhYmxlIChvcHRpb25hbClcbiAgICBjb25zdCBlbnZFbWFpbHMgPSBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19TVVBFUlVTRVJfRU1BSUxTPy5zcGxpdCgnLCcpIHx8IFtdO1xuICAgIHJldHVybiBlbnZFbWFpbHMubWFwKGUgPT4gZS50b0xvd2VyQ2FzZSgpLnRyaW0oKSkuaW5jbHVkZXMobG93ZXJFbWFpbCk7XG59OyJdLCJuYW1lcyI6WyJTVVBFUlVTRVJfRU1BSUxTIiwiaXNTdXBlcnVzZXJFbWFpbCIsImVtYWlsIiwibG93ZXJFbWFpbCIsInRvTG93ZXJDYXNlIiwidHJpbSIsIm1hcCIsImUiLCJpbmNsdWRlcyIsImVudkVtYWlscyIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1BVQkxJQ19TVVBFUlVTRVJfRU1BSUxTIiwic3BsaXQiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./src/constants/superuser.ts\n");

/***/ })

};
;