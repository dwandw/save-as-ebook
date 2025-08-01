## 项目简介 | Project Overview

本项目基于 [alexadam/save-as-ebook](https://github.com/alexadam/save-as-ebook) 进行二次开发，旨在优化 Chrome 扩展的兼容性与性能，支持生成符合 EPUB v3 标准的电子书文档，并通过 streamsaver.js 降低内存消耗。

This project is a fork of [alexadam/save-as-ebook](https://github.com/alexadam/save-as-ebook), aiming to enhance Chrome extension compatibility and performance. It supports generating EPUB v3 compliant eBook documents and reduces memory usage with streamsaver.js.

## 主要特性 | Main Features

- 适配 Chrome 扩展 Manifest V3  
    Adapted for Chrome Extension Manifest V3

- 支持 EPUB v3 电子书格式  
    Supports EPUB v3 eBook format

- 集成 streamsaver.js，提升性能并降低内存占用  
    Integrated streamsaver.js for better performance and lower memory usage

## 安装与使用 | Installation & Usage

1. 克隆本仓库  
     Clone this repository

     ```bash
     git clone https://github.com/dwandw/save-as-ebook.git
     ```

2. 在 Chrome 浏览器中加载已解压的扩展程序  
     Load the unpacked extension in Chrome

     - 打开 `chrome://extensions/`
     - 启用“开发者模式”
     - 点击“加载已解压的扩展程序”，选择项目文件夹

3. 按需使用扩展功能保存网页为 EPUB  
     Use the extension to save web pages as EPUB as needed

## 相关链接 | Related Links

- [Chrome 扩展商店原始扩展](https://chromewebstore.google.com/detail/save-as-ebook/haaplkpoiimngbppjihnegfmpejdnffj)
- [原始项目地址 | Original Project](https://github.com/alexadam/save-as-ebook)

## 许可证 | License

本项目遵循原项目的开源协议。  
This project follows the open source license of the original repository.