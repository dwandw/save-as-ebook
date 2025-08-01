var ebookTitle = null

function setIsBusy(isBusy) {
    chrome.runtime.sendMessage({
        type: "set is busy",
        isBusy: isBusy
    }).catch(() => { })
}

async function downloadImageUint8Array(url) {
    var response = await chrome.runtime.sendMessage({ type: "download", url: url })
    return new Uint8Array(response)
}

// http://ebooks.stackexchange.com/questions/1183/what-is-the-minimum-required-content-for-a-valid-epub
async function buildEbook(allPages) {
    allPages = allPages.filter(function (page) {
        return page !== null
    })

    setIsBusy(true)

    console.log('Prepare Content...')

    var ebookFileName = 'eBook.epub'

    if (ebookTitle) {
        // ~TODO a pre-processing function to apply escapeXMLChars to all page.titles
        ebookName = escapeXMLChars(ebookTitle)
        ebookFileName = getEbookFileName(removeSpecialChars(ebookTitle)) + '.epub'
    } else {
        ebookName = escapeXMLChars(allPages[0].title)
        ebookFileName = getEbookFileName(removeSpecialChars(allPages[0].title)) + '.epub'
    }


    for (var page of allPages) {
        for (var tmpImg of page.allImages) {
            var filename = tmpImg.filename
            if (filename.endsWith("TODO-EXTRACT")) {
                var uint8Array = await downloadImageUint8Array(tmpImg.originalUrl)
                let oldFilename = filename
                let arr = uint8Array.subarray(0, 4)
                let header = ""
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16)
                }
                if (header.startsWith("89504e47")) {
                    filename = filename.replace("TODO-EXTRACT", "png")
                } else if (header.startsWith("47494638")) {
                    filename = filename.replace("TODO-EXTRACT", "gif")
                } else if (header.startsWith("ffd8ff")) {
                    filename = filename.replace("TODO-EXTRACT", "jpg")
                } else {
                    // ERROR
                    console.log("Error! Unable to extract the image type!")
                    debugger
                }
                page.content = page.content.replace(oldFilename, filename)
                tmpImg.filename = filename
            }
            page.images.push({
                filename: filename,
            })
        }
    }
    setIsBusy(false)

    // 初始化打包对象
    const readableZipStream = new window.ZIP({
        async pull(ctrl) {

            // mimetype
            ctrl.enqueue(new File(['application/epub+zip'], 'mimetype'))
            // META-INF/container.xml
            ctrl.enqueue(new File([`
<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>
                `.trim()], 'META-INF/container.xml'))

            // OEBPS/Text/nav.xhtml
            var contents = allPages.reduce(function (prev, page) {
                var tmpPageTitle = escapeXMLChars(page.title)
                return `${prev}\n            <li><a href="./${page.url}">${tmpPageTitle}</a></li>`
            }, '')
            ctrl.enqueue(new File([`
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${ebookName}</title>
</head>
<body epub:type="bodymatter">
    <nav id="toc" epub:type="toc"> 
        <h1 class="frontmatter">目录</h1>
        <ol class="contents">
            ${contents.trim()}
        </ol>
    </nav>
</body>
</html>
                `.trim()], 'OEBPS/Text/nav.xhtml'))

            // OEBPS/Styles/*.css
            allPages.forEach(function (page) {
                if (page.styleFileContent) {
                    ctrl.enqueue(new File([page.styleFileContent], `OEBPS/Styles/${page.styleFileName}`))
                }
            })

            function getCssStyleLink(page) {
                if(page.styleFileContent){
                    return `<link href="../style/${page.styleFileName}" rel="stylesheet" type="text/css" />`
                } else {
                    return ''
                }
            }
            // OEBPS/Text/*.xhtml
            allPages.forEach(function (page) {
                // console.log(page.content)
                var tmpPageTitle = escapeXMLChars(page.title)
                ctrl.enqueue(new File([`
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
    <head>
        <title>${tmpPageTitle}</title>
        ${getCssStyleLink(page)}
    </head>
    <body>
        ${page.content}
    </body>
</html>
        `.trim()], `OEBPS/Text/${page.url}`))
            })

            var generateBooks = allPages.reduce(function (prev, page, index) {
                return `${prev}
        <item id="ebook-${index}" href="Text/${page.url}" media-type="application/xhtml+xml" />`
            }, '')
            var generateStyles = allPages.reduce(function (prev, page, index) {
                if (!page.styleFileContent) {
                    return prev
                }
                return `${prev}
        <item id="style-${index}" href="Styles/${page.styleFileName}" media-type="text/css" />`
            }, '')
            function getImagesIndex(allImages) {
                return allImages.reduce(function (prev, elem, index) {
                    return `${prev}
        <item id="img-${elem.filename}" href="Images/${elem.filename}" media-type="image/${getImageType(elem.filename)}"/>`
                }, '')
            }
            var generateImages = allPages.reduce(function (prev, page, index) {
                return `${prev}
${getImagesIndex(page.images).trim()}`
            }, '')
            var generateSpines = allPages.reduce(function (prev, page, index) {
                return `${prev}
        <itemref idref="ebook-${index}" />`
            }, '')
            // OEBPS/content.opf
            ctrl.enqueue(new File(
                [`
<?xml version="1.0" encoding="UTF-8" ?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="db-id" version="3.0">
    <metadata>
        <dc:title id="t1">${ebookName}</dc:title>
        <dc:creator>佚名</dc:creator>
        <dc:publisher>佚名</dc:publisher>
        <dc:identifier id="db-id">isbn</dc:identifier>
        <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z/i, 'Z')}</meta>
        <dc:language>en</dc:language>
    </metadata>

    <manifest>
        <item id="nav.xhtml" href="Text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        ${generateBooks.trim()}
        ${generateStyles.trim()}
        ${generateImages.trim()}
    </manifest>
    <spine toc="ncx">
        ${generateSpines.trim()}
    </spine>
</package>
        `.trim()],
                'OEBPS/content.opf'
            ));

            // OEBPS/Images/*
            for (let page of allPages) {
                for (let tmpImg of page.allImages) {
                    let filename = tmpImg.filename
                    let name = `OEBPS/Images/${filename}`
                    let uint8Array = await downloadImageUint8Array(tmpImg.originalUrl)
                    let stream = () => new Blob([uint8Array], { type: 'image/*' }).stream()
                    ctrl.enqueue({ name, stream })
                }
            }

            ctrl.close();

            chrome.runtime.sendMessage({
                type: "done"
            }).catch(() => { })
        },
    });

    // 资源命名
    const fileStream = streamSaver.createWriteStream(ebookFileName);

    // more optimized
    if (window.WritableStream && readableZipStream.pipeTo) {
        return readableZipStream
            .pipeTo(fileStream)
            .then(() => {
                console.log('下载成功')
            })
            .catch((error) => {
                console.error('下载失败', error);
            })
    }

    // less optimized
    const writer = fileStream.getWriter();
    const reader = readableZipStream.getReader();
    const pump = () =>
        reader
            .read()
            .then(() => {
                console.log('下载成功2')
            })
            .catch((error) => {
                console.error('下载失败2', error);
            })

    pump();

}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.shortcut && request.shortcut === 'build-ebook') {
        buildEbook(request.response)
        sendResponse({})
    } else if (request.alert) {
        alert(request.alert)
        sendResponse({})
    }
    return true
})