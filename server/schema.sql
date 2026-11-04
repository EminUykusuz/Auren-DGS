-- Auren DGS MSSQL şeması (idempotent). Çalıştırma: npm run migrate
IF DB_ID(N'DgsTouch') IS NULL CREATE DATABASE DgsTouch;
GO
USE DgsTouch;
GO

IF OBJECT_ID(N'dbo.Users') IS NULL
CREATE TABLE dbo.Users (
  Id                INT IDENTITY(1,1) PRIMARY KEY,
  Username          NVARCHAR(30)  NOT NULL,
  Email             NVARCHAR(254) NOT NULL,
  PasswordHash      NVARCHAR(100) NOT NULL,
  ResetTokenHash    CHAR(64)      NULL,
  ResetTokenExpires DATETIME2     NULL,
  CreatedAt         DATETIME2     NOT NULL CONSTRAINT DF_Users_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Users_Username UNIQUE (Username),
  CONSTRAINT UQ_Users_Email UNIQUE (Email)
);
GO

IF OBJECT_ID(N'dbo.PasswordResets') IS NULL
CREATE TABLE dbo.PasswordResets (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  UserId    INT       NOT NULL CONSTRAINT FK_PR_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  TokenHash CHAR(64)  NOT NULL,
  ExpiresAt DATETIME2 NOT NULL,
  IsUsed    BIT       NOT NULL CONSTRAINT DF_PR_Used DEFAULT 0
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PR_TokenHash')
  CREATE UNIQUE INDEX IX_PR_TokenHash ON dbo.PasswordResets(TokenHash);
GO

IF OBJECT_ID(N'dbo.Friendships') IS NULL
CREATE TABLE dbo.Friendships (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  RequesterId INT NOT NULL CONSTRAINT FK_F_Req  REFERENCES dbo.Users(Id),
  AddresseeId INT NOT NULL CONSTRAINT FK_F_Addr REFERENCES dbo.Users(Id),
  Status      VARCHAR(10) NOT NULL CONSTRAINT DF_F_Status DEFAULT 'pending',
  CreatedAt   DATETIME2   NOT NULL CONSTRAINT DF_F_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_F_Status CHECK (Status IN ('pending','accepted')),
  CONSTRAINT CK_F_NotSelf CHECK (RequesterId <> AddresseeId),
  -- (A,B) ve (B,A) çiftini tek kayda indirger
  PairLow  AS (CASE WHEN RequesterId < AddresseeId THEN RequesterId ELSE AddresseeId END) PERSISTED,
  PairHigh AS (CASE WHEN RequesterId < AddresseeId THEN AddresseeId ELSE RequesterId END) PERSISTED,
  CONSTRAINT UQ_F_Pair UNIQUE (PairLow, PairHigh)
);
GO

IF OBJECT_ID(N'dbo.StudySessions') IS NULL
CREATE TABLE dbo.StudySessions (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  UserId          INT NOT NULL CONSTRAINT FK_SS_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  SubjectKey      VARCHAR(20) NOT NULL,
  TopicKey        VARCHAR(60) NOT NULL,
  DurationMinutes INT NOT NULL,
  QuestionsSolved INT NOT NULL CONSTRAINT DF_SS_Q DEFAULT 0,
  CorrectCount    INT NOT NULL CONSTRAINT DF_SS_C DEFAULT 0,
  WrongCount      INT NOT NULL CONSTRAINT DF_SS_W DEFAULT 0,
  StudyDate       DATE NOT NULL,
  CONSTRAINT CK_SS_Counts CHECK (CorrectCount >= 0 AND WrongCount >= 0 AND CorrectCount + WrongCount <= QuestionsSolved),
  CONSTRAINT CK_SS_Dur CHECK (DurationMinutes BETWEEN 1 AND 1440)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SS_User_Date')
  CREATE INDEX IX_SS_User_Date ON dbo.StudySessions(UserId, StudyDate);
GO

IF OBJECT_ID(N'dbo.TrialExams') IS NULL
CREATE TABLE dbo.TrialExams (
  Id           INT IDENTITY(1,1) PRIMARY KEY,
  UserId       INT NOT NULL CONSTRAINT FK_TE_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  ExamName     NVARCHAR(100) NOT NULL,
  MathCorrect  INT NOT NULL,
  MathWrong    INT NOT NULL,
  MathNet      DECIMAL(6,2) NOT NULL,
  TurkceCorrect INT NOT NULL,
  TurkceWrong  INT NOT NULL,
  TurkceNet    DECIMAL(6,2) NOT NULL,
  ExamDate     DATE NOT NULL,
  CONSTRAINT CK_TE_Math   CHECK (MathCorrect >= 0 AND MathWrong >= 0 AND MathCorrect + MathWrong <= 50),
  CONSTRAINT CK_TE_Turkce CHECK (TurkceCorrect >= 0 AND TurkceWrong >= 0 AND TurkceCorrect + TurkceWrong <= 50),
  -- Net = Doğru - Yanlış/4 (DB seviyesinde ikinci güvence)
  CONSTRAINT CK_TE_MathNet   CHECK (MathNet   = MathCorrect   - MathWrong   * 0.25),
  CONSTRAINT CK_TE_TurkceNet CHECK (TurkceNet = TurkceCorrect - TurkceWrong * 0.25)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TE_User_Date')
  CREATE INDEX IX_TE_User_Date ON dbo.TrialExams(UserId, ExamDate);
GO

IF OBJECT_ID(N'dbo.SubjectProgress') IS NULL
CREATE TABLE dbo.SubjectProgress (
  Id                INT IDENTITY(1,1) PRIMARY KEY,
  UserId            INT NOT NULL CONSTRAINT FK_SP_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  SubjectKey        VARCHAR(20) NOT NULL,
  TopicKey          VARCHAR(60) NOT NULL,
  Status            VARCHAR(12) NOT NULL CONSTRAINT DF_SP_Status DEFAULT 'not_started',
  TargetQuestions   INT NOT NULL CONSTRAINT DF_SP_T DEFAULT 100,
  CompletedQuestions INT NOT NULL CONSTRAINT DF_SP_C DEFAULT 0,
  CONSTRAINT CK_SP_Status CHECK (Status IN ('not_started','in_progress','completed')),
  CONSTRAINT CK_SP_Counts CHECK (TargetQuestions >= 0 AND CompletedQuestions >= 0),
  CONSTRAINT UQ_SP UNIQUE (UserId, SubjectKey, TopicKey)
);
GO

-- v2: yönetici paneli alanları
IF COL_LENGTH('dbo.Users', 'IsAdmin') IS NULL
  ALTER TABLE dbo.Users ADD IsAdmin BIT NOT NULL CONSTRAINT DF_Users_IsAdmin DEFAULT 0;
GO
IF COL_LENGTH('dbo.Users', 'IsDisabled') IS NULL
  ALTER TABLE dbo.Users ADD IsDisabled BIT NOT NULL CONSTRAINT DF_Users_IsDisabled DEFAULT 0;
GO
IF COL_LENGTH('dbo.Users', 'LastLoginAt') IS NULL
  ALTER TABLE dbo.Users ADD LastLoginAt DATETIME2 NULL;
GO

-- v3: hedef üniversite + geri bildirim
IF COL_LENGTH('dbo.Users', 'TargetUniversity') IS NULL
  ALTER TABLE dbo.Users ADD TargetUniversity NVARCHAR(120) NULL, TargetDepartment NVARCHAR(120) NULL;
GO
IF OBJECT_ID(N'dbo.Feedback') IS NULL
CREATE TABLE dbo.Feedback (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  UserId     INT NOT NULL CONSTRAINT FK_FB_User REFERENCES dbo.Users(Id) ON DELETE CASCADE,
  Category   VARCHAR(12) NOT NULL,
  Subject    NVARCHAR(100) NOT NULL,
  Message    NVARCHAR(2000) NOT NULL,
  MailStatus VARCHAR(10) NOT NULL CONSTRAINT DF_FB_Mail DEFAULT 'queued',
  MailError  NVARCHAR(300) NULL,
  CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_FB_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_FB_Cat CHECK (Category IN ('oneri','hata','soru','diger')),
  CONSTRAINT CK_FB_Mail CHECK (MailStatus IN ('queued','sent','failed'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FB_Created')
  CREATE INDEX IX_FB_Created ON dbo.Feedback(CreatedAt DESC);
GO

-- v4: sınav tarihi + deneme hata nedenleri
IF COL_LENGTH('dbo.Users', 'ExamDate') IS NULL
  ALTER TABLE dbo.Users ADD ExamDate DATE NULL;
GO
IF OBJECT_ID(N'dbo.TrialExamErrors') IS NULL
CREATE TABLE dbo.TrialExamErrors (
  Id      INT IDENTITY(1,1) PRIMARY KEY,
  ExamId  INT NOT NULL CONSTRAINT FK_TEE_Exam REFERENCES dbo.TrialExams(Id) ON DELETE CASCADE,
  Subject VARCHAR(10) NOT NULL,
  Reason  VARCHAR(10) NOT NULL,
  Cnt     INT NOT NULL,
  CONSTRAINT CK_TEE_Subject CHECK (Subject IN ('matematik','turkce')),
  CONSTRAINT CK_TEE_Reason CHECK (Reason IN ('dikkat','konu','sure','formul','diger')),
  CONSTRAINT CK_TEE_Cnt CHECK (Cnt BETWEEN 1 AND 50),
  CONSTRAINT UQ_TEE UNIQUE (ExamId, Subject, Reason)
);
GO
