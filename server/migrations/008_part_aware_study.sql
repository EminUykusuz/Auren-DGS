-- 008: çalışma oturumları ve konu ilerlemesi bölüm bazlı (DGS | TYT | AYT). Tekrar çalıştırılabilir (idempotent).
IF COL_LENGTH('dbo.StudySessions','ExamPart') IS NULL
  ALTER TABLE dbo.StudySessions ADD ExamPart VARCHAR(3) NOT NULL CONSTRAINT DF_SS_Part DEFAULT 'DGS';
GO
IF COL_LENGTH('dbo.SubjectProgress','ExamPart') IS NULL
  ALTER TABLE dbo.SubjectProgress ADD ExamPart VARCHAR(3) NOT NULL CONSTRAINT DF_SP_Part DEFAULT 'DGS';
GO
-- Eski YKS kayıtları: yalnızca AYT'ye özgü konular AYT, kalanı TYT sayılır
UPDATE dbo.StudySessions SET ExamPart = 'TYT' WHERE ExamType = 'YKS' AND ExamPart = 'DGS';
UPDATE dbo.StudySessions SET ExamPart = 'AYT' WHERE ExamType = 'YKS' AND (SubjectKey = 'edebiyat' OR TopicKey IN
  ('trigonometri','logaritma','diziler','limit','turev','integral','analitik','donusumler','modern-fizik','enerji-hiz','denge-elektro','organik','insan-fizyolojisi','gen-protein','bitki-komunite')
  OR (SubjectKey = 'felsefe' AND TopicKey = 'mantik'));
UPDATE dbo.SubjectProgress SET ExamPart = 'TYT' WHERE ExamType = 'YKS' AND ExamPart = 'DGS';
UPDATE dbo.SubjectProgress SET ExamPart = 'AYT' WHERE ExamType = 'YKS' AND (SubjectKey = 'edebiyat' OR TopicKey IN
  ('trigonometri','logaritma','diziler','limit','turev','integral','analitik','donusumler','modern-fizik','enerji-hiz','denge-elektro','organik','insan-fizyolojisi','gen-protein','bitki-komunite')
  OR (SubjectKey = 'felsefe' AND TopicKey = 'mantik'));
GO
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_SP_Type')
  ALTER TABLE dbo.SubjectProgress DROP CONSTRAINT UQ_SP_Type;
GO
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_SP_Part')
  ALTER TABLE dbo.SubjectProgress ADD CONSTRAINT UQ_SP_Part UNIQUE (UserId, ExamType, ExamPart, SubjectKey, TopicKey);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SS_User_Part_Date')
  CREATE INDEX IX_SS_User_Part_Date ON dbo.StudySessions(UserId, ExamType, ExamPart, StudyDate);
GO
