# 高校实验室危险试剂领用与废液回收平台

面向高校实验室的危险试剂「申请 → 审批 → 出库 → 使用 → 废液 → 转运」全链路闭环管理系统。
平台自动判定试剂危险类别（易制毒 / 易制爆 / 剧毒 / 强腐蚀 / 低温保存），串联导师、实验室安全员、库管、学院审核四类责任角色，并对「用量超申请、通风橱故障、试剂过期、废液桶将满、异常洒漏」自动生成异常工单转安全员复核，确保试剂领走后最终回到废弃物处置链路，不停留在台账。

## 技术栈

- **前端**：Vue 3 + Vite + Element Plus + Pinia + Vue Router（nginx 非 root 镜像提供静态服务并反向代理 `/api`）
- **后端**：NestJS 10 + TypeORM + JWT 鉴权（角色守卫）
- **数据库**：PostgreSQL 16（首次启动自动建表并注入演示数据）

## 快速开始（Docker 一键部署）

```bash
cp .env.example .env        # 按需修改端口/密钥
docker compose up -d --build
```

启动后访问：`http://localhost:${CC_PUBLISH_PORT}`（`.env` 中的 `CC_PUBLISH_PORT`，示例为 3012）。

- 仅前端端口发布到宿主机；PostgreSQL 与后端仅在 compose 内部网络互访。
- 首次启动自动完成建表与演示数据初始化（`SEED_DEMO=false` 可关闭）。
- 验证方式：宿主机执行 `docker compose up -d`，待 `docker compose ps` 全部 healthy 后，
  用 `docker compose port frontend 8080` 获取映射端口，浏览器访问 `http://localhost:<端口>`。

## 测试账号（演示数据）

| 角色 | 用户名 | 密码 | 权限说明 |
|---|---|---|---|
| 学生 | `zhangsan` | `Student@123` | 提交领用申请、使用登记（化学学院·有机合成课题组，培训有效） |
| 学生 | `lisi` | `Student@123` | 同上（培训记录已过期，用于演示安全员拦截） |
| 学生 | `wangwu` | `Student@123` | 同上（材料学院，剧毒试剂专项培训） |
| 导师 | `wangprof` | `Advisor@123` | 审批本人名下申请（确认实验必要性） |
| 导师 | `liuprof` | `Advisor@123` | 同上 |
| 安全员 | `safety` | `Safety@123` | 安全核查（培训/防护/通风橱/同组/库存）、处理异常工单、查看全链路 |
| 库管 | `keeper` | `Keeper@123` | 批次入库、出库发放（批号/余量/有效期/开封/领取人）、废液入库、创建转运单 |
| 学院审核 | `college` | `College@123` | 转运单审核（通过后链路闭环） |
| 管理员 | `admin` | `Admin@12345` | 用户管理、试剂目录维护、全部数据 |

## 演示数据说明

- **试剂目录**：丙酮/盐酸/硫酸（易制毒）、硝酸（易制爆）、高锰酸钾（易制毒+易制爆）、重铬酸钾（易制爆+剧毒）、氰化钾（剧毒）、氢氟酸（剧毒+强腐蚀）、液氮（低温保存）、无水乙醇（普通对照）。
- **申请单**：覆盖「待导师审批 / 待安全员审批（培训过期+批次过期，演示拦截）/ 待出库（剧毒双人领取）/ 使用中 / 已登记使用（超量异常）/ 全链路已闭环」全部状态。
- **异常工单**：用量超申请（盐酸 350>300ml）、废液桶 WF-ORG-01 液位 91% 预警；硝酸批次已过期（打开异常页自动巡检生成）。
- **转运单**：一笔已由学院审核通过的闭环样例（绿源危废处置有限公司）。

## 一条建议的端到端演示流程

1. `zhangsan` 登录 → 新建领用申请（选「丙酮」，自动判定易制毒、双人领取、限量 500ml）。
2. `wangprof` 登录 → 审批中心 → 同意（确认实验必要性）。
3. `safety` 登录 → 申请详情 → 查看自动预检（培训记录/有效库存）→ 勾选五项核查、指定通风橱 → 批准。
4. `keeper` 登录 → 申请详情 → 选择批次出库（批号/余量/有效期/开封/双人领取人）。
5. `zhangsan` 登录 → 使用登记（实际用量填超过申请量可触发异常；可勾选通风橱故障）。
6. `keeper` 登录 → 申请详情 → 废液入库（自动匹配原试剂与项目，选桶、填容器标签；桶液位 ≥90% 自动预警）。
7. `keeper` 登录 → 转运单 → 勾选已入库废液 → 填危废公司/称重/交接照片 → 提交学院审核。
8. `college` 登录 → 转运单 → 审核通过 → 申请单状态变为「已闭环」。
9. `safety` 登录 → 异常处理 → 查看链路闭合情况并填写处理结论。
10. 工作台 → 责任视图：按学院 / 课题组 / 库房 / 危险等级查看闭环率与未处理异常。

## 目录结构

```
├── docker-compose.yml        # app(frontend+backend) + postgres，仅前端发布端口
├── .env.example
├── backend/                  # NestJS：实体/鉴权/申请/库存/废液/转运/异常/看板/种子数据
│   ├── Dockerfile            # 多阶段构建，非 root(node) 运行，含 HEALTHCHECK
│   └── src/{common,modules,seed}
└── frontend/                 # Vue3 + Element Plus
    ├── Dockerfile            # 多阶段构建，nginxinc/nginx-unprivileged 非 root，含 HEALTHCHECK
    └── src/{views,router,stores,api,utils}
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `CC_PUBLISH_PORT` | 3012 | 宿主机发布端口（应用入口） |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | labuser / labpass123 / labreagent | PostgreSQL 账号 |
| `JWT_SECRET` | dev-secret-change-me | JWT 签名密钥，生产必改 |
| `SEED_DEMO` | true | 首次启动是否注入演示数据 |

## 主要 API（前缀 `/api`）

- `POST /auth/login` 登录；`GET /dashboard/summary`、`GET /dashboard/responsibility?dim=college|group|warehouse|danger` 责任视图
- `POST /requisitions` 学生申请（自动判定危险类别）；`GET /requisitions/:id/chain` 全链路视图
- `POST /requisitions/:id/advisor-decision` 导师审批；`POST /requisitions/:id/safety-decision` 安全员审批（服务端复核培训与库存）
- `POST /requisitions/:id/dispense` 库管出库（事务+行锁，校验限量/双人/有效期）；`POST /requisitions/:id/usage` 使用登记（触发异常）
- `POST /waste/requisitions/:id/store` 废液入库（匹配试剂/项目/标签，桶液位预警）；`POST /waste/manifests` 转运单；`POST /waste/manifests/:id/review` 学院审核闭环
- `GET /anomalies` 异常工单；`POST /anomalies/:id/resolve` 安全员处理
