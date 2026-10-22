public class Usuario {
    private String nombre;
    private String correo;
    private Armario armario;

    public Usuario(String nombre, String correo) {
        this.nombre = nombre;
        this.correo = correo;
        this.armario = new Armario();
    }

    public String getNombre() {
        return nombre;
    }

    public String getCorreo() {
        return correo;
    }

    public Armario getArmario() {
        return armario;
    }
}