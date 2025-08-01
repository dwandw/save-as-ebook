try {
    importScripts('libs/chrome-extension-async.js')
} catch (e) {
    console.error(e)
}
///////////////////
///////////////////
///////////////////
///////////////////
/// Only for testing

chrome.runtime.onInstalled.addListener(details => {
    if (navigator.userAgent === 'PuppeteerTestingAgent') {
        let TEST_TIMER = null
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (TEST_TIMER) {
                clearTimeout(TEST_TIMER)
            }

            TEST_TIMER = setTimeout(() => {
                executeCommand({ type: 'save-page' })
            }, 2000)
        })
    }
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        checkCommandShortcuts()
    }
})

function checkCommandShortcuts() {
    chrome.commands.getAll((commands) => {
        let missingShortcuts = []

        for (let { name, shortcut } of commands) {
            if (shortcut === '') {
                missingShortcuts.push(name)
            }
        }

        if (missingShortcuts.length > 0) {
            console.error(`Missing shortcuts for commands: ${missingShortcuts.join(', ')}`)
        }
    })
}



///////////////////
///////////////////
///////////////////
///////////////////

var isBusy = false
var busyResetTimer = null

var defaultStyles = [
    {
        title: 'Reddit Comments',
        url: 'reddit\\.com\\/r\\/[^\\/]+\\/comments',
        style: `.side {
display: none;
}
#header {
display: none;
}
.arrow, .expand, .score, .live-timestamp, .flat-list, .buttons, .morecomments, .footer-parent, .icon {
display: none !important;
}
`
    }, {
        title: 'Wikipedia Article',
        url: 'wikipedia\\.org\\/wiki\\/',
        style: `#mw-navigation {
display: none;
}
#footer {
display: none;
}
#mw-panel {
display: none;
}
#mw-head {
display: none;
}
`
    }, {
        title: 'YCombinator News Comments',
        url: 'news\\.ycombinator\\.com\\/item\\?id=[0-9]+',
        style: `#hnmain > tbody > tr:nth-child(1) > td > table {
display: none;
}
* {
background-color: white;
}
.title, .storylink {
text-align: left;
font-weight: bold;
font-size: 20px;
}
.score {
display: none;
}
.age {
display: none;
}
.hnpast {
display: none;
}
.togg {
display: none;
}
.votelinks, .rank {
display: none;
}
.votearrow {
display: none;
}
.yclinks {
display: none;
}
form {
display: none;
}
a.hnuser {
font-weight: bold;
color: black !important;
padding: 3px;
}
.subtext > span, .subtext > a:not(:nth-child(2)) {
display: none;
}
`
    }, {
        title: 'Medium Article',
        url: 'medium\\.com',
        style: `.metabar {
display: none !important;
}
header.container {
display: none;
}
.js-postShareWidget {
display: none;
}
footer, canvas {
display: none !important;
}
.u-fixed, .u-bottom0 {
display: none;
}
`
    }, {
        title: 'Twitter',
        url: 'twitter\\.com\\/.+',
        style: `.topbar {
display: none !important;
}
.ProfileCanopy, .ProfileCanopy-inner {
display: none;
}
.ProfileSidebar {
display: none;
}
.ProfileHeading {
display: none !important;
}
.ProfileTweet-actionList {
display: none;
}
`
    }

]

chrome.commands.onCommand.addListener((command) => {
    executeCommand({ type: command })
})

async function executeCommand(command) {
    if (isBusy) {
        var tabs = await chrome.tabs.query({
            currentWindow: true,
            active: true
        })
        var tabId = tabs[0].id
        var r = await chrome.tabs.sendMessage(tabId, { 'alert': 'Work in progress! Please wait until the current eBook is generated!' }).catch(() => { })
        console.log(r)
        return
    }
    if (command.type === 'save-page') {
        await dispatch('extract-page', false, [])
    } else if (command.type === 'save-selection') {
        await dispatch('extract-selection', false, [])
    } else if (command.type === 'add-page') {
        await dispatch('extract-page', true, [])
    } else if (command.type === 'add-selection') {
        await dispatch('extract-selection', true, [])
    } else if (command.type === 'edit-chapters') {
        var tabs = await chrome.tabs.query({
            currentWindow: true,
            active: true
        })
        var tabId = tabs[0].id
        var r = await chrome.tabs.sendMessage(tabId, 'edit-chapters').catch(() => { })
        return
    }

    isBusy = true

    busyResetTimer = setTimeout(async () => {
        await resetBusy()
    }, 20000)
}

async function dispatch(action, justAddToBuffer, appliedStyles) {
    if (!justAddToBuffer) {
        await chrome.storage.local.remove('allPages')
        await chrome.storage.local.remove('title')
    }
    await chrome.action.setBadgeBackgroundColor({ color: "red" })
    await chrome.action.setBadgeText({ text: "Busy" })

    var tabs = await chrome.tabs.query({
        currentWindow: true,
        active: true
    })
    var tab = tabs[0]
    await isIncludeStyles((result) => {
        let isIncludeStyle = result.includeStyle
        prepareStyles(tab, isIncludeStyle, appliedStyles, (tmpAppliedStyles) => {
            applyAction(tab, action, justAddToBuffer, isIncludeStyle, tmpAppliedStyles, () => {
                console.log('done')
            })
        })
    })
}

async function isIncludeStyles(callback) {
    var data = await chrome.storage.local.get('includeStyle')
    if (!data || data.includeStyle === undefined) {
        callback({ includeStyle: false })
    } else {
        callback({ includeStyle: data.includeStyle })
    }
}

async function prepareStyles(tab, includeStyle, appliedStyles, callback) {
    if (!includeStyle) {
        callback(appliedStyles)
        return
    }

    var data = chrome.storage.local.get('styles')
    let styles = defaultStyles
    if (data && data.styles) {
        styles = data.styles
    }
    let currentUrl = tab.url
    let currentStyle = null

    if (!styles) {
        callback(appliedStyles)
        return
    }

    if (styles.length === 0) {
        callback(appliedStyles)
        return
    }

    let allMatchingStyles = []

    for (let i = 0; i < styles.length; i++) {
        currentUrl = currentUrl.replace(/(http[s]?:\/\/|www\.)/i, '').toLowerCase()
        let styleUrl = styles[i].url
        let styleUrlRegex = null

        try {
            styleUrlRegex = new RegExp(styleUrl, 'i')
        } catch (e) {
        }

        if (styleUrlRegex && styleUrlRegex.test(currentUrl)) {
            allMatchingStyles.push({
                index: i,
                length: styleUrl.length
            })
        }
    }

    if (allMatchingStyles.length === 0) {
        callback(appliedStyles)
        return
    }

    allMatchingStyles.sort((a, b) => b.length - a.length)
    let selStyle = allMatchingStyles[0]

    if (!selStyle) {
        callback(appliedStyles)
        return
    }

    currentStyle = styles[selStyle.index]

    if (!currentStyle) {
        callback(appliedStyles)
        return
    }

    if (!currentStyle.style) {
        callback(appliedStyles)
        return
    }

    await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: currentStyle.style
    })
    appliedStyles.push(currentStyle)
    callback(appliedStyles)
}

async function applyAction(tab, action, justAddToBuffer, includeStyle, appliedStyles, callback) {
    var tabId = tab.id
    var response = await chrome.tabs.sendMessage(tabId, {
        type: action,
        includeStyle: includeStyle,
        appliedStyles: appliedStyles
    })
    if (!response || response.content === undefined) {
        await resetBusy()
        await chrome.tabs.sendMessage(tabId, { 'alert': 'Save as eBook does not work on this web site!' }).catch(() => { })
        return
    }

    if (response.content.trim() === '') {
        await resetBusy()
        if (justAddToBuffer) {
            await chrome.tabs.sendMessage(tabId, { 'alert': 'Cannot add an empty selection as chapter!' }).catch(() => { })
        } else {
            await chrome.tabs.sendMessage(tabId, { 'alert': 'Cannot generate the eBook from an empty selection!' }).catch(() => { })
        }
        return
    }
    if (!justAddToBuffer) {
        await chrome.tabs.sendMessage(tabId, { 'shortcut': 'build-ebook', response: [response] }).catch(() => { })
    } else {
        var data = await chrome.storage.local.get('allPages')
        if (!data || !data.allPages) {
            data.allPages = []
        }
        data.allPages.push(response)
        await chrome.storage.local.set({ 'allPages': data.allPages })
        await resetBusy()
        await chrome.tabs.sendMessage(tabId, { 'alert': 'Page or selection added as chapter!' }).catch(() => { })
    }
}

async function resetBusy() {
    isBusy = false

    if (busyResetTimer) {
        clearTimeout(busyResetTimer)
        busyResetTimer = null
    }

    await chrome.action.setBadgeText({ text: "" })

    await chrome.runtime.sendMessage('closePopup').catch(() => { })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    _execute(request, sendResponse)
    return true
})

async function _execute(request, sendResponse) {
    if (request.type === 'get') {
        var data = await chrome.storage.local.get('allPages')
        if (!data || !data.allPages) {
            sendResponse({ allPages: [] })
            return
        }
        sendResponse({ allPages: data.allPages })
    }
    if (request.type === 'set') {
        await chrome.storage.local.set({ 'allPages': request.pages })
        sendResponse({})
    }
    if (request.type === 'remove') {
        await chrome.storage.local.remove('allPages')
        await chrome.storage.local.remove('title')
        sendResponse({})
    }
    if (request.type === 'get title') {
        var data = await chrome.storage.local.get('title')
        if (!data || !data.title || data.title.trim().length === 0) {
            sendResponse({ title: 'eBook' })
        } else {
            sendResponse({ title: data.title })
        }
    }
    if (request.type === 'set title') {
        await chrome.storage.local.set({ 'title': request.title })
        sendResponse({})
    }
    if (request.type === 'get styles') {
        var data = await chrome.storage.local.get('styles')
        if (!data || !data.styles) {
            sendResponse({ styles: defaultStyles })
        } else {
            sendResponse({ styles: data.styles })
        }
    }
    if (request.type === 'set styles') {
        await chrome.storage.local.set({ 'styles': request.styles })
        sendResponse({})
    }
    if (request.type === 'get current style') {
        var data = await chrome.storage.local.get('currentStyle')
        if (!data || !data.currentStyle) {
            sendResponse({ currentStyle: 0 })
        } else {
            sendResponse({ currentStyle: data.currentStyle })
        }
    }
    if (request.type === 'set current style') {
        await chrome.storage.local.set({ 'currentStyle': request.currentStyle })
        sendResponse({})
    }
    if (request.type === 'get include style') {
        var data = await chrome.storage.local.get('includeStyle')
        if (!data) {
            sendResponse({ includeStyle: false })
        } else {
            sendResponse({ includeStyle: data.includeStyle })
        }
    }
    if (request.type === 'set include style') {
        await chrome.storage.local.set({ 'includeStyle': request.includeStyle })
        sendResponse({})
    }
    if (request.type === 'is busy?') {
        sendResponse({ isBusy: isBusy })
    }
    if (request.type === 'set is busy') {
        isBusy = request.isBusy
        sendResponse({})
    }
    if (request.type === 'save-page' || request.type === 'save-selection' ||
        request.type === 'add-page' || request.type === 'add-selection') {
        await executeCommand({ type: request.type })
        sendResponse({})
    }
    if (request.type === 'done') {
        await resetBusy()
        sendResponse({})
    }
    if (request.type === 'download') {
        download(request.url, sendResponse, 3)
    }
}

function download(url, sendResponse, times) {
    // Sending from content script
    const reader = new FileReader()
    reader.onloadend = () => {
        const uint8Array = new Uint8Array(reader.result)
        sendResponse(Array.from(uint8Array))
    }

    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            reader.readAsArrayBuffer(blob)
        })
        .catch(error => {
            if (times > 0) {
                download(url, sendResponse, times - 1)
            } else {
                console.error(`Download error:${url}`, error)
                sendResponse(null)
            }
        })
}
