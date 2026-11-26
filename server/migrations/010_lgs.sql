-- 010: LGS (8. sınıf) desteği. Net kuralı 3 yanlış 1 doğru; LGS hesabı DGS/YKS ile karışmaz (uygulama katmanında kilitli).
-- Yinelenebilir: kısıtlar adıyla bulunup yeniden kurulur.

-- 1) Aktif mod ve hazırlık türü
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_ExamMode') ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_ExamMode;
ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_ExamMode CHECK (ExamMode IN ('DGS','YKS','LGS'));
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_ExamTrack') ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_ExamTrack;
ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_ExamTrack CHECK (ExamTrack IN ('DGS','YKS','LGS','BOTH'));
GO
IF COL_LENGTH('dbo.Users', 'LgsExamDate') IS NULL ALTER TABLE dbo.Users ADD LgsExamDate DATE NULL;
GO

-- 2) Kurumun hazırlık türü
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Inst_Track') ALTER TABLE dbo.Institutions DROP CONSTRAINT CK_Inst_Track;
ALTER TABLE dbo.Institutions ADD CONSTRAINT CK_Inst_Track CHECK (ExamTrack IN ('DGS','YKS','LGS','BOTH'));
GO

-- 3) Deneme bölümü, çalışma ve ilerleme tabloları
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TE_Part') ALTER TABLE dbo.TrialExams DROP CONSTRAINT CK_TE_Part;
ALTER TABLE dbo.TrialExams ADD CONSTRAINT CK_TE_Part CHECK (
  (ExamType = 'DGS' AND ExamPart = 'DGS') OR (ExamType = 'YKS' AND ExamPart IN ('TYT','AYT')) OR (ExamType = 'LGS' AND ExamPart = 'LGS'));
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SS_Type') ALTER TABLE dbo.StudySessions DROP CONSTRAINT CK_SS_Type;
ALTER TABLE dbo.StudySessions ADD CONSTRAINT CK_SS_Type CHECK (ExamType IN ('DGS','YKS','LGS'));
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SP_Type') ALTER TABLE dbo.SubjectProgress DROP CONSTRAINT CK_SP_Type;
ALTER TABLE dbo.SubjectProgress ADD CONSTRAINT CK_SP_Type CHECK (ExamType IN ('DGS','YKS','LGS'));
GO

-- 4) Bölüm neti: 4 yanlış 1 doğru (DGS/YKS: tam çeyrek) ya da 3 yanlış 1 doğru (LGS: 2 haneye yuvarlı)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_TES_Net') ALTER TABLE dbo.TrialExamSections DROP CONSTRAINT CK_TES_Net;
ALTER TABLE dbo.TrialExamSections ADD CONSTRAINT CK_TES_Net CHECK (
  Net = Correct - Wrong * 0.25 OR ABS(Net - (Correct - Wrong / 3.0)) <= 0.005);
GO
