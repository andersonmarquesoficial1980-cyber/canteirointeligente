import { motion } from "framer-motion";
import { ArrowRight, Mail, MapPin } from "lucide-react";

const Contact = () => {
  return (
    <section id="contact" className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display text-sm tracking-[0.3em] uppercase mb-4">Get In Touch</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            Let's build something <span className="text-gradient">extraordinary</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 md:p-12"
        >
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-display text-muted-foreground mb-2">Name</label>
                <input
                  type="text"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors font-body"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-display text-muted-foreground mb-2">Email</label>
                <input
                  type="email"
                  className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors font-body"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-display text-muted-foreground mb-2">Message</label>
              <textarea
                rows={5}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors font-body resize-none"
                placeholder="Tell us about your project..."
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-display font-semibold text-sm tracking-wide hover:glow-sm transition-all duration-300 hover:scale-[1.02]"
            >
              Send Message
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row gap-6 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              hello@rdodigital.com
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Global · Remote First
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
