$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class PhantomPadBrandArt {
  static GraphicsPath LeftWing() {
    var p = new GraphicsPath(FillMode.Winding);
    p.StartFigure(); p.AddBezier(80,180,80,135,115,100,160,100); p.AddLine(160,100,224,100);
    p.AddBezier(224,100,235,100,244,109,244,120); p.AddLine(244,120,244,212);
    p.AddBezier(244,212,244,223,235,232,224,232); p.AddLine(224,232,176,232);
    p.AddBezier(176,232,165,232,156,241,156,252); p.AddLine(156,252,156,260);
    p.AddBezier(156,260,156,271,165,280,176,280); p.AddLine(176,280,224,280);
    p.AddBezier(224,280,235,280,244,289,244,300); p.AddLine(244,300,244,392);
    p.AddBezier(244,392,244,403,235,412,224,412); p.AddLine(224,412,160,412);
    p.AddBezier(160,412,115,412,80,377,80,332); p.CloseFigure(); return p;
  }
  static GraphicsPath RightWing() {
    var p = new GraphicsPath(FillMode.Winding);
    p.StartFigure(); p.AddBezier(432,332,432,377,397,412,352,412); p.AddLine(352,412,288,412);
    p.AddBezier(288,412,277,412,268,403,268,392); p.AddLine(268,392,268,300);
    p.AddBezier(268,300,268,289,277,280,288,280); p.AddLine(288,280,336,280);
    p.AddBezier(336,280,347,280,356,271,356,260); p.AddLine(356,260,356,252);
    p.AddBezier(356,252,356,241,347,232,336,232); p.AddLine(336,232,288,232);
    p.AddBezier(288,232,277,232,268,223,268,212); p.AddLine(268,212,268,120);
    p.AddBezier(268,120,268,109,277,100,288,100); p.AddLine(288,100,352,100);
    p.AddBezier(352,100,397,100,432,135,432,180); p.CloseFigure(); return p;
  }
  static GraphicsPath Nexus() {
    var p = new GraphicsPath(); p.AddPolygon(new PointF[] {
      new PointF(256,188),new PointF(276,236),new PointF(324,256),new PointF(276,276),
      new PointF(256,324),new PointF(236,276),new PointF(188,256),new PointF(236,236)
    }); return p;
  }
  public static void DrawMark(Graphics g, float x, float y, float size) {
    var state = g.Save();
    g.TranslateTransform(x, y); g.ScaleTransform(size / 512f, size / 512f);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    using (var a = new SolidBrush(ColorTranslator.FromHtml("#00F5D4"))) using (var p = LeftWing()) g.FillPath(a,p);
    using (var b = new SolidBrush(ColorTranslator.FromHtml("#4F46E5"))) using (var p = RightWing()) g.FillPath(b,p);
    using (var c = new SolidBrush(ColorTranslator.FromHtml("#F8FAFC"))) using (var p = Nexus()) g.FillPath(c,p);
    g.Restore(state);
  }
  static Bitmap New24(int width, int height) { return new Bitmap(width,height,PixelFormat.Format24bppRgb); }
  public static void SaveIcon(string file) {
    if (System.IO.File.Exists(file)) System.IO.File.Delete(file);
    using (var bmp = new Bitmap(512,512,PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) { g.Clear(Color.Transparent); DrawMark(g,0,0,512); }
      bmp.Save(file,ImageFormat.Png);
    }
  }
  public static void SaveHeader(string file) {
    if (System.IO.File.Exists(file)) System.IO.File.Delete(file);
    using (var bmp = New24(150,57)) using (var g = Graphics.FromImage(bmp)) {
      g.SmoothingMode=SmoothingMode.AntiAlias;
      using (var brush=new LinearGradientBrush(new Rectangle(0,0,150,57),ColorTranslator.FromHtml("#111924"),ColorTranslator.FromHtml("#20204A"),35f)) g.FillRectangle(brush,0,0,150,57);
      using (var p=new Pen(ColorTranslator.FromHtml("#00F5D4"),3f)) g.DrawLine(p,0,0,0,57);
      DrawMark(g,7,8,41);
      using (var f=new Font("Segoe UI",10f,FontStyle.Bold,GraphicsUnit.Point)) using (var b=new SolidBrush(ColorTranslator.FromHtml("#F8FAFC"))) g.DrawString("PHANTOMPAD",f,b,52,13);
      using (var f=new Font("Segoe UI",6f,FontStyle.Regular,GraphicsUnit.Point)) using (var b=new SolidBrush(ColorTranslator.FromHtml("#9EABBB"))) g.DrawString("WIRELESS CONTROL DECK",f,b,53,31);
      bmp.Save(file,ImageFormat.Bmp);
    }
  }
  public static void SaveSidebar(string file) {
    if (System.IO.File.Exists(file)) System.IO.File.Delete(file);
    using (var bmp = New24(164,314)) using (var g = Graphics.FromImage(bmp)) {
      g.SmoothingMode=SmoothingMode.AntiAlias;
      using (var brush=new LinearGradientBrush(new Rectangle(0,0,164,314),ColorTranslator.FromHtml("#101722"),ColorTranslator.FromHtml("#17173A"),35f)) g.FillRectangle(brush,0,0,164,314);
      using (var brush=new LinearGradientBrush(new Point(0,0),new Point(164,0),ColorTranslator.FromHtml("#00F5D4"),ColorTranslator.FromHtml("#4F46E5"))) g.FillRectangle(brush,0,0,164,4);
      DrawMark(g,18,36,128);
      using (var p=new Pen(Color.FromArgb(42,210,226,239),1f)) g.DrawLine(p,20,183,144,183);
      using (var f=new Font("Segoe UI",12f,FontStyle.Bold,GraphicsUnit.Point)) using (var b=new SolidBrush(ColorTranslator.FromHtml("#F8FAFC"))) {
        var format=new StringFormat { Alignment=StringAlignment.Center };
        g.DrawString("PHANTOMPAD",f,b,new RectangleF(8,198,148,24),format);
      }
      using (var f=new Font("Segoe UI",7.5f,FontStyle.Regular,GraphicsUnit.Point)) using (var b=new SolidBrush(ColorTranslator.FromHtml("#AAB6C4"))) {
        var format=new StringFormat { Alignment=StringAlignment.Center, LineAlignment=StringAlignment.Near };
        g.DrawString("YOUR PHONE. YOUR\nCONTROL DECK.",f,b,new RectangleF(14,232,136,38),format);
      }
      using (var p=new Pen(Color.FromArgb(100,0,245,212),1f)) g.DrawLine(p,45,285,119,285);
      bmp.Save(file,ImageFormat.Bmp);
    }
  }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$resources = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $resources | Out-Null
[PhantomPadBrandArt]::SaveIcon((Join-Path $root 'electron\icon.png'))
[PhantomPadBrandArt]::SaveHeader((Join-Path $resources 'installerHeader.bmp'))
[PhantomPadBrandArt]::SaveSidebar((Join-Path $resources 'installerSidebar.bmp'))
Write-Output 'Updated the Windows app icon and generated PhantomPad NSIS installer artwork.'
