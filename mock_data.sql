INSERT INTO company (id, name, "ceoName", "businessNumber", address, phone, email, industry, "foundedDate", "createdAt") VALUES
('co001', '(주)한국솔루션', '김한국', '123-45-67890', '서울시 강남구', '02-1234-5678', 'contact@koreasol.co.kr', 'IT서비스', '2015-03-15', NOW()),
('co002', '글로벌테크(주)', '이글로벌', '234-56-78901', '서울시 마포구', '02-2345-6789', 'info@globaltech.kr', '소프트웨어', '2018-07-22', NOW()),
('co003', '(주)미래인포', '박미래', '345-67-89012', '부산시 해운대구', '051-345-6789', 'master@mi-future.kr', '정보처리', '2016-11-30', NOW()),
('co004', '에코파워(주)', '최에코', '456-78-90123', '대전시 유성구', '042-456-7890', 'biz@ecopower.kr', '에너지', '2019-02-14', NOW()),
('co005', '메디시스템(주)', '정메디', '567-89-01234', '광주시北区', '062-567-8901', 'contact@medisys.kr', '의료기기', '2014-08-05', NOW()),
('co006', '(주)스마트벤처', '刘스마트', '678-90-12345', '서울시 영등포구', '02-678-9012', 'hello@smartvc.kr', 'AI로봇', '2020-01-20', NOW()),
('co007', '바이오휴먼(주)', '장바이오', '789-01-23456', '인천시经济开发区', '032-789-0123', 'info@biohuman.kr', '바이오테크', '2017-05-18', NOW()),
('co008', '핀테크프로(주)', '황핀테크', '890-12-34567', '서울시 강남구', '02-890-1234', 'contact@fintechpro.kr', '금융기술', '2019-09-09', NOW()),
('co009', '(주)그린머티리얼', '윤그린', '901-23-45678', '대구시 수성구', '053-901-2345', 'biz@greenmat.kr', '신소재', '2016-04-25', NOW()),
('co010', '스마트로직(주)', '구스마트', '012-34-56789', '서울시 서초구', '02-012-3456', 'info@smartlogic.kr', '반도체', '2018-12-01', NOW());

INSERT INTO evaluation_session (id, title, description, status, "committeeSize", "trimRule", "createdAt") VALUES
('ses001', '2026年度 新規事業 選定評価', '新規事業の支援先を選定するための評価セッションです。', 'open', 5, 'exclude_min_max', NOW());

INSERT INTO session_committee_assignment (id, role, "assignedAt", "sessionId", "committeeMemberId") VALUES
('sca001', 'chair', NOW(), 'ses001', 'cm001'),
('sca002', 'member', NOW(), 'ses001', 'cm002'),
('sca003', 'member', NOW(), 'ses001', 'cm003'),
('sca004', 'member', NOW(), 'ses001', 'cm004'),
('sca005', 'member', NOW(), 'ses001', 'cm005');

INSERT INTO application (id, "evaluationOrder", status, notes, "createdAt", "sessionId", "companyId") VALUES
('app001', 1, 'registered', NULL, NOW(), 'ses001', 'co001'),
('app002', 2, 'registered', NULL, NOW(), 'ses001', 'co002'),
('app003', 3, 'registered', NULL, NOW(), 'ses001', 'co003'),
('app004', 4, 'registered', NULL, NOW(), 'ses001', 'co004'),
('app005', 5, 'registered', NULL, NOW(), 'ses001', 'co005'),
('app006', 6, 'registered', NULL, NOW(), 'ses001', 'co006'),
('app007', 7, 'registered', NULL, NOW(), 'ses001', 'co007'),
('app008', 8, 'registered', NULL, NOW(), 'ses001', 'co008'),
('app009', 9, 'registered', NULL, NOW(), 'ses001', 'co009'),
('app010', 10, 'registered', NULL, NOW(), 'ses001', 'co010');

SELECT 'All mock data inserted!' as result;
