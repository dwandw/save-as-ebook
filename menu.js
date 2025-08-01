var allStyles = []
var currentStyle = null
var appliedStyles = []

// create menu labels
document.getElementById('menuTitle').innerHTML = chrome.i18n.getMessage('extName')
document.getElementById('includeStyle').innerHTML = chrome.i18n.getMessage('includeStyle')
document.getElementById('editStyles').innerHTML = chrome.i18n.getMessage('editStyles')
document.getElementById('savePageLabel').innerHTML = chrome.i18n.getMessage('savePage')
document.getElementById('saveSelectionLabel').innerHTML = chrome.i18n.getMessage('saveSelection')
document.getElementById('pageChapterLabel').innerHTML = chrome.i18n.getMessage('pageChapter')
document.getElementById('selectionChapterLabel').innerHTML = chrome.i18n.getMessage('selectionChapter')
document.getElementById('editChaptersLabel').innerHTML = chrome.i18n.getMessage('editChapters')
document.getElementById('waitMessage').innerHTML = chrome.i18n.getMessage('waitMessage')

async function createStyleList(styles) {
    allStyles = styles
    var tabs = await chrome.tabs.query({ 'active': true })
    let currentUrl = tabs[0].url

    if (!styles || styles.length === 0 || !currentUrl) {
        return
    }

    let foundMatchingUrl = false

    // if multiple URL regexes match, select the longest one
    let allMatchingStyles = []

    for (let i = 0; i < styles.length; i++) {
        let listItem = document.createElement('option')
        listItem.id = 'option_' + i
        listItem.className = 'cssEditor-chapter-item'
        listItem.value = 'option_' + i
        listItem.innerText = styles[i].title

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

    if (allMatchingStyles.length >= 1) {
        allMatchingStyles.sort(function (a, b) {
            return b.length - a.length
        })
        let selStyle = allMatchingStyles[0]
        currentStyle = styles[selStyle.index]

        chrome.runtime.sendMessage({
            type: "set current style",
            currentStyle: currentStyle
        }).catch(() => { })
    }
}

function createIncludeStyle(data) {
    let includeStyleCheck = document.getElementById('includeStyleCheck')
    includeStyleCheck.checked = data
}

async function dispatch(commandType, justAddToBuffer) {
    document.getElementById('busy').style.display = 'block'
    if (!justAddToBuffer) {
        removeEbook()
    }
    await chrome.runtime.sendMessage({
        type: commandType
    })
    //FIXME - hidden before done
    document.getElementById('busy').style.display = 'none'
}

async function init() {
    var response = await chrome.runtime.sendMessage({
        type: "is busy?"
    })
    if (response.isBusy) {
        document.getElementById('busy').style.display = 'block'
    } else {
        document.getElementById('busy').style.display = 'none'
    }

    var response = await chrome.runtime.sendMessage({
        type: "get styles"
    })
    await createStyleList(response.styles)

    var response = await chrome.runtime.sendMessage({
        type: "get include style"
    })
    createIncludeStyle(response.includeStyle)

    document.getElementById('includeStyleCheck').onclick = function () {
        let includeStyleCheck = document.getElementById('includeStyleCheck')
        chrome.runtime.sendMessage({
            type: "set include style",
            includeStyle: includeStyleCheck.checked
        }).catch(() => { })
    }

    document.getElementById("editStyles").onclick = async function () {
        if (document.getElementById('cssEditor-Modal')) {
            return
        }
        var tabs = chrome.tabs.query({
            currentWindow: true,
            active: true
        })
        var tabId = tabs[0].id
        chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ["./cssEditor.css"]
        })
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['./cssEditor.js'],
        })
        window.close()
    }

    document.getElementById("editChapters").onclick = async function () {
        if (document.getElementById('chapterEditor-Modal')) {
            return
        }
        var tabs = await chrome.tabs.query({
            currentWindow: true,
            active: true
        })
        var tabId = tabs[0].id
        var r = await chrome.tabs.sendMessage(tabId, 'edit-chapters').catch(() => { })
        window.close()
    }

    document.getElementById('savePage').onclick = async function () {
        await dispatch('save-page', false)
    }

    document.getElementById('saveSelection').onclick = async function () {
        await dispatch('save-selection', false)
    }

    document.getElementById('pageChapter').onclick = async function () {
        await dispatch('add-page', true)
    }

    document.getElementById('selectionChapter').onclick = async function () {
        await dispatch('add-selection', true)
    }

    // get all shortcuts and display them in the menuTitle
    chrome.commands.getAll((commands) => {
        for (let command of commands) {
            if (command.name === 'save-page') {
                document.getElementById('savePageShortcut').appendChild(document.createTextNode(command.shortcut))
            } else if (command.name === 'save-selection') {
                document.getElementById('saveSelectionShortcut').appendChild(document.createTextNode(command.shortcut))
            } else if (command.name === 'add-page') {
                document.getElementById('pageChapterShortcut').appendChild(document.createTextNode(command.shortcut))
            } else if (command.name === 'add-selection') {
                document.getElementById('selectionChapterShortcut').appendChild(document.createTextNode(command.shortcut))
            } else if (command.name === 'edit-chapters') {
                document.getElementById('editChaptersShortcut').appendChild(document.createTextNode(command.shortcut))
            }
        }
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request === 'closePopup') {
            sendResponse({})
            window.close()
        }
        return true
    })

}

init()