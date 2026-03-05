const Footer = () => {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="font-display font-bold text-lg tracking-tight">
          RDO<span className="text-gradient">.</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} RDO Digital. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
