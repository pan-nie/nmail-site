---
name: Nmail
description: AI 驱动的本地聚合邮箱客户端——多账号一个收件箱，AI 总管家分类/归档/拟稿（审批/自动双模式），跨会话记忆与每日摘要 + AI 摘要，数据全程留在本机（MIT）。
status: active
url: https://nmail.whizzzest.com
repo: https://github.com/pan-nie/Nmail
order: 1
---

本地运行的 AI 邮箱管家：FastAPI + SQLite 后端、浏览器界面，服务只监听 127.0.0.1。
v0.3.0 完成文件资源管理器式邮箱、AI 总管家 2.0（对话 Agent + 审批/自动双模式 + 全量审计）、
统一草稿、通讯录、OAuth 零配置授权与对外 API；v0.4.0 Agent 化收官：跨会话记忆、AI 摘要（晨报更名）、
触顶进度小结、ask_user 澄清中断、内置工作流技能、完成断言防幻觉，以及 nmail-cli 总管家通道
（agent ask 一条命令委托内置 AI）。
